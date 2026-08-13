"""
Layer 3 — only runs when Layers 1 and 2 can't confidently decide. Reads
logs, K8s events, metrics, and the deploying commit to produce a
natural-language root cause, a confidence score, and a recommended action.

This is the most expensive layer (API cost + latency), which is exactly
why it's last in the chain, not first.
"""
from app.clients.loki_client import LokiClient
from app.clients.k8s_client import K8sClient
from app.clients.prometheus_client import PrometheusClient
from app.clients.anthropic_client import AnthropicAnalyzer
from app.models import Layer3Result
from app.config import settings


def run_layer3(app_label: str, commit_message: str, diff_summary: str) -> Layer3Result:
    loki = LokiClient(settings.loki_url)
    k8s = K8sClient(namespace=settings.k8s_namespace)
    prom = PrometheusClient(settings.prometheus_url)

    error_logs = loki.error_lines(app_label, minutes=5)
    events = k8s.get_recent_events(app_label)
    metrics = prom.metrics_snapshot(app_label)

    analyzer = AnthropicAnalyzer(
        api_key=settings.anthropic_api_key, model=settings.claude_model
    )
    result = analyzer.analyze(
        logs=error_logs,
        k8s_events=events,
        metrics=metrics,
        commit_message=commit_message,
        diff_summary=diff_summary,
    )

    return Layer3Result(
        status=result.get("status", "unknown"),
        root_cause=result.get("root_cause", "unknown"),
        confidence=int(result.get("confidence", 0)),
        recommended_action=result.get("recommended_action", "HUMAN_REVIEW"),
        explanation=result.get("explanation", ""),
        evidence_summary=result.get("evidence_summary", {}),
    )
