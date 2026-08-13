"""
Used by the "Generate Fix -> hotfix branch -> PR" flow
(core/app/fix_generator.py). This client only ever opens a DRAFT PR on a
NEW branch — it never pushes to main, never merges, and never touches
any branch other than the one it creates. A human always has to click
"merge" themselves.
"""
import base64
import httpx


class GitHubClient:
    def __init__(self, token: str, repo: str):
        self.repo = repo
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        }
        self.base_url = "https://api.github.com"

    def get_default_branch_sha(self, branch: str = "main") -> str:
        resp = httpx.get(
            f"{self.base_url}/repos/{self.repo}/git/ref/heads/{branch}",
            headers=self.headers, timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["object"]["sha"]

    def create_branch(self, new_branch: str, from_branch: str = "main") -> dict:
        """Creates new_branch pointing at the current tip of from_branch.
        Fails loudly (raise_for_status) if the branch already exists --
        intentional, so you never silently overwrite an existing hotfix."""
        base_sha = self.get_default_branch_sha(from_branch)
        resp = httpx.post(
            f"{self.base_url}/repos/{self.repo}/git/refs",
            headers=self.headers,
            json={"ref": f"refs/heads/{new_branch}", "sha": base_sha},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_file_content(self, path: str, branch: str = "main") -> tuple[str, str]:
        """Returns (content, sha) -- the sha is required by GitHub's API
        to update an existing file (it's how the API detects conflicting
        concurrent edits)."""
        resp = httpx.get(
            f"{self.base_url}/repos/{self.repo}/contents/{path}",
            headers=self.headers, params={"ref": branch}, timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        content = base64.b64decode(data["content"]).decode("utf-8")
        return content, data["sha"]

    def update_file(self, path: str, new_content: str, message: str,
                     branch: str, existing_sha: str) -> dict:
        resp = httpx.put(
            f"{self.base_url}/repos/{self.repo}/contents/{path}",
            headers=self.headers,
            json={
                "message": message,
                "content": base64.b64encode(new_content.encode("utf-8")).decode("ascii"),
                "sha": existing_sha,
                "branch": branch,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def open_pull_request(self, branch: str, base: str, title: str, body: str,
                           draft: bool = True) -> dict:
        """draft=True by default -- a draft PR cannot be merged with GitHub's
        normal merge button until someone marks it 'ready for review' first.
        This is a deliberate extra speed bump against an accidental auto-merge."""
        resp = httpx.post(
            f"{self.base_url}/repos/{self.repo}/pulls",
            headers=self.headers,
            json={"title": title, "head": branch, "base": base, "body": body, "draft": draft},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_commit_diff(self, sha: str) -> str:
        resp = httpx.get(
            f"{self.base_url}/repos/{self.repo}/commits/{sha}",
            headers={**self.headers, "Accept": "application/vnd.github.diff"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.text[:5000]  # cap size to keep LLM prompts cheap
