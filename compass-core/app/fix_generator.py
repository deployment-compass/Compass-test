"""
The "Generate Fix" branch from the original architecture diagram.
Deliberately scoped narrow and safe:

  - Only triggers when the decision engine already said ROLLBACK and
    Layer 3 gave a specific, high-confidence root cause -- never on a
    vague or low-confidence diagnosis.
  - Only ever edits ONE pre-approved file (AUTO_FIX_TARGET_FILE in
    config.py) -- it cannot touch arbitrary files in your repo. Widen
    this list yourself once you trust the output on one file.
  - Always creates a NEW branch (hotfix/<short-sha>-<timestamp>) and
    opens a DRAFT pull request. It never pushes to main and never
    merges anything -- a human always has the final say.
  - If the AI's proposed fix doesn't look like valid Python for a .py
    target (a basic sanity check, not a full test run), the PR is not
    opened and the run is logged as skipped instead.

This is intentionally the riskiest part of the system. Off by default
-- see ENABLE_AUTO_FIX in config.py.
"""
import time
import ast
import json
import anthropic

from app.clients.github_client import GitHubClient
from app.config import settings

FIX_SYSTEM_PROMPT = """You are a senior engineer proposing a minimal, safe
hotfix for a production incident. You will be given the suspected root
cause, the relevant evidence, and the full current contents of ONE file.

Respond with ONLY a JSON object (no markdown fences, no preamble):

{
  "can_fix": true | false,
  "new_file_content": "the COMPLETE corrected file content, or empty string if can_fix is false",
  "summary": "one sentence describing what changed and why",
  "risk_notes": "anything a human reviewer should double check before merging"
}

Rules:
- Only set can_fix true if you are confident the root cause is actually
  fixable with a small, targeted change to THIS file.
- new_file_content must be the ENTIRE file, not a diff or a snippet --
  it will be committed verbatim.
- Keep the change as small as possible. Do not refactor unrelated code.
- If you're not confident, set can_fix false and explain why in risk_notes
  instead of guessing.
"""


def _looks_like_valid_python(source: str) -> bool:
    """Cheap sanity check before we ever push AI-generated code anywhere --
    this is NOT a substitute for tests or review, just a guard against
    obviously broken output (unbalanced brackets, syntax errors, etc)."""
    try:
        ast.parse(source)
        return True
    except SyntaxError:
        return False


def generate_and_open_hotfix_pr(root_cause: str, evidence_summary: dict,
                                 commit_sha: str) -> dict:
    """Returns a dict describing what happened -- always, even on failure
    or skip, so the caller can log it in the incident report rather than
    silently doing nothing."""
    if not settings.enable_auto_fix:
        return {"attempted": False, "reason": "ENABLE_AUTO_FIX is false"}

    if not settings.github_token or not settings.github_repo:
        return {"attempted": False, "reason": "GITHUB_TOKEN or GITHUB_REPO not configured"}

    gh = GitHubClient(token=settings.github_token, repo=settings.github_repo)
    target_path = settings.auto_fix_target_file

    try:
        current_content, file_sha = gh.get_file_content(target_path)
    except Exception as e:
        return {"attempted": False, "reason": f"could not read {target_path}: {e}"}

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    user_content = f"""
--- Suspected root cause ---
{root_cause}

--- Evidence ---
{json.dumps(evidence_summary, indent=2)}

--- Current contents of {target_path} ---
{current_content}
"""
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=4000,
        system=FIX_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(b.text for b in response.content if b.type == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        fix = json.loads(text)
    except json.JSONDecodeError:
        return {"attempted": True, "opened_pr": False, "reason": "AI response was not valid JSON"}

    if not fix.get("can_fix"):
        return {"attempted": True, "opened_pr": False,
                "reason": fix.get("risk_notes", "AI did not propose a fix")}

    new_content = fix["new_file_content"]
    if target_path.endswith(".py") and not _looks_like_valid_python(new_content):
        return {"attempted": True, "opened_pr": False,
                "reason": "proposed fix failed Python syntax check -- not pushed"}

    branch_name = f"hotfix/{commit_sha[:7]}-{int(time.time())}"

    try:
        gh.create_branch(branch_name, from_branch="main")
        gh.update_file(
            path=target_path,
            new_content=new_content,
            message=f"Hotfix: {fix['summary']}",
            branch=branch_name,
            existing_sha=file_sha,
        )
        pr = gh.open_pull_request(
            branch=branch_name,
            base="main",
            title=f"[compass hotfix] {fix['summary']}",
            body=(
                f"**Auto-generated by compass — human review required before merging.**\n\n"
                f"**Root cause:** {root_cause}\n\n"
                f"**Proposed change:** {fix['summary']}\n\n"
                f"**Risk notes from the AI:** {fix.get('risk_notes', 'none noted')}\n\n"
                f"This PR is a DRAFT and was not merged automatically. "
                f"Review the diff carefully before marking it ready and merging."
            ),
            draft=True,
        )
        return {
            "attempted": True, "opened_pr": True,
            "branch": branch_name, "pr_url": pr.get("html_url"),
            "summary": fix["summary"],
        }
    except Exception as e:
        return {"attempted": True, "opened_pr": False, "reason": f"GitHub API error: {e}"}
