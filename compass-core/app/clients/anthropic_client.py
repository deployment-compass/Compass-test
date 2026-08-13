"""
Wraps the Anthropic Messages API. Forces structured JSON output so
Layer 3 can parse it directly into a Layer3Result without regex.
"""
import json
import anthropic

SYSTEM_PROMPT = """You are a senior Site Reliability Engineer analyzing a
software deployment for signs of failure. You will be given application
logs, Kubernetes events, a metrics summary, and the git diff for the
commit being deployed.

Respond with ONLY a JSON object (no markdown fences, no preamble) matching
exactly this schema:

{
  "status": "healthy" | "degraded" | "failing" | "unknown",
  "root_cause": "short string, 'none apparent' if healthy",
  "confidence": integer 0-100,
  "recommended_action": "PROCEED" | "ROLLBACK" | "HUMAN_REVIEW",
  "explanation": "2-4 sentence plain-language explanation an on-call engineer can read in 10 seconds",
  "evidence_summary": {"key_signal": "short description", ...}
}

Guidelines:
- Only recommend ROLLBACK if you have specific evidence (a matching error
  in logs/events tied to the new commit), not just "metrics look a bit off".
- If evidence is thin or ambiguous, prefer HUMAN_REVIEW over ROLLBACK —
  false-positive rollbacks are costly.
- confidence should reflect how certain you are, not how bad the failure is.
"""


class AnthropicAnalyzer:
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def analyze(
        self,
        logs: list[str],
        k8s_events: list[dict],
        metrics: dict,
        commit_message: str,
        diff_summary: str,
    ) -> dict:
        user_content = f"""
--- Application Logs (most recent, error-filtered) ---
{chr(10).join(logs[:100]) or "No error-level logs in the soak window."}

--- Kubernetes Events ---
{json.dumps(k8s_events[:30], indent=2)}

--- Metrics Summary (new deployment) ---
{json.dumps(metrics, indent=2)}

--- Deploying Commit ---
Message: {commit_message}
Diff summary: {diff_summary}
"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(
            block.text for block in response.content if block.type == "text"
        )
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Fail safe: if the model didn't return clean JSON, don't crash
            # the pipeline — fall through to HUMAN_REVIEW.
            return {
                "status": "unknown",
                "root_cause": "LLM response could not be parsed",
                "confidence": 0,
                "recommended_action": "HUMAN_REVIEW",
                "explanation": "AI analysis returned an unparseable response; escalating for manual review.",
                "evidence_summary": {"raw_response": text[:500]},
            }
