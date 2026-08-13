"""
Minimal Loki LogQL query wrapper. Pulls recent logs for a given app label —
used to feed Layer 3's LLM reasoning with actual evidence, not summaries.
"""
import time
import httpx


class LokiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def recent_logs(self, app_label: str, minutes: int = 5, limit: int = 200) -> list[str]:
        end = int(time.time() * 1e9)
        start = int((time.time() - minutes * 60) * 1e9)
        query = f'{{app="{app_label}"}}'
        try:
            resp = httpx.get(
                f"{self.base_url}/loki/api/v1/query_range",
                params={
                    "query": query,
                    "start": start,
                    "end": end,
                    "limit": limit,
                    "direction": "backward",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            lines = []
            for stream in data.get("data", {}).get("result", []):
                for value in stream.get("values", []):
                    lines.append(value[1])
            return lines
        except Exception as e:
            print(f"Loki query failed: {e}")
            return []

    def error_lines(self, app_label: str, minutes: int = 5) -> list[str]:
        """Cheap client-side filter for likely-relevant lines — keeps the
        LLM prompt small (and cheap) by not shipping every log line."""
        all_lines = self.recent_logs(app_label, minutes=minutes)
        keywords = ("error", "exception", "traceback", "fatal", "panic", "fail")
        return [l for l in all_lines if any(k in l.lower() for k in keywords)]
