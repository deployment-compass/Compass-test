"""
Layer 2 — compares the new (canary) deployment's metrics against its own
historical baseline rather than a fixed threshold. Catches subtler
degradation that Layer 1's hard thresholds miss (e.g. latency creeping up
20% without breaching any absolute limit).

Deliberately simple statistics (percentage deviation) rather than a full
ML model — this is meant to be explainable and cheap to run on every
deploy. Swap in a proper z-score / EWMA model later if you want more rigor.
"""
from app.clients.prometheus_client import PrometheusClient
from app.models import Layer2Result
from app.config import settings

DEVIATION_FAIL_THRESHOLD = 0.5     # 50% worse than baseline -> fail
DEVIATION_WARN_THRESHOLD = 0.2     # 20% worse -> inconclusive, escalate to Layer 3


def _pct_deviation(new: float | None, baseline: float | None) -> float | None:
    if new is None or baseline in (None, 0):
        return None
    return (new - baseline) / baseline


def run_layer2(app_label: str, baseline_app_label: str) -> Layer2Result:
    prom = PrometheusClient(settings.prometheus_url)

    new_metrics = prom.metrics_snapshot(app_label)
    baseline_metrics = prom.metrics_snapshot(baseline_app_label)

    latency_dev = _pct_deviation(
        new_metrics.get("p95_latency_seconds"), baseline_metrics.get("p95_latency_seconds")
    )
    error_dev = _pct_deviation(
        new_metrics.get("error_rate"), baseline_metrics.get("error_rate")
    )

    deviations = [d for d in (latency_dev, error_dev) if d is not None]
    worst = max(deviations) if deviations else None

    compared = {
        "new": new_metrics,
        "baseline": baseline_metrics,
        "latency_deviation_pct": latency_dev,
        "error_rate_deviation_pct": error_dev,
    }

    if worst is None:
        return Layer2Result(verdict="INCONCLUSIVE", reason="insufficient_metric_data",
                             metrics_compared=compared)

    if worst >= DEVIATION_FAIL_THRESHOLD:
        return Layer2Result(verdict="FAIL", deviation_score=worst,
                             reason="significant_deviation_from_baseline",
                             metrics_compared=compared)

    if worst >= DEVIATION_WARN_THRESHOLD:
        return Layer2Result(verdict="INCONCLUSIVE", deviation_score=worst,
                             reason="moderate_deviation_escalating_to_ai",
                             metrics_compared=compared)

    return Layer2Result(verdict="PASS", deviation_score=worst,
                         reason="within_normal_range", metrics_compared=compared)
