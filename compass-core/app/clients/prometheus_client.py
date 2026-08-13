"""
Minimal PromQL query wrapper. Assumes Prometheus is reachable at
settings.prometheus_url (port-forward it locally: see docs/setup.md).
"""
import httpx


class PrometheusClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def instant_query(self, promql: str) -> float | None:
        """Run a PromQL instant query, return the first scalar result."""
        try:
            resp = httpx.get(
                f"{self.base_url}/api/v1/query",
                params={"query": promql},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("data", {}).get("result", [])
            if not results:
                return None
            return float(results[0]["value"][1])
        except Exception as e:
            print(f"Prometheus query failed: {e}")
            return None

    def error_rate(self, app_label: str, window: str = "2m") -> float | None:
        query = (
            f'sum(rate(http_requests_total{{app="{app_label}",status=~"5.."}}[{window}])) '
            f'/ sum(rate(http_requests_total{{app="{app_label}"}}[{window}]))'
        )
        return self.instant_query(query)

    def p95_latency(self, app_label: str, window: str = "2m") -> float | None:
        query = (
            f'histogram_quantile(0.95, sum(rate('
            f'http_request_duration_seconds_bucket{{app="{app_label}"}}[{window}])) by (le))'
        )
        return self.instant_query(query)

    def cpu_usage(self, app_label: str, window: str = "2m") -> float | None:
        query = (
            f'sum(rate(container_cpu_usage_seconds_total{{pod=~"{app_label}.*"}}[{window}]))'
        )
        return self.instant_query(query)

    def metrics_snapshot(self, app_label: str) -> dict:
        return {
            "error_rate": self.error_rate(app_label),
            "p95_latency_seconds": self.p95_latency(app_label),
            "cpu_usage": self.cpu_usage(app_label),
        }
