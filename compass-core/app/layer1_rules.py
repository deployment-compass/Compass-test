"""
Layer 1 — deterministic, millisecond-scale checks. Catches obvious
breakage (crash loops, unready pods, hard threshold breaches) without
touching statistics or the LLM. This is your cheapest and fastest
signal — always run it first.
"""
from app.clients.k8s_client import K8sClient
from app.clients.prometheus_client import PrometheusClient
from app.models import Layer1Result
from app.config import settings


def run_layer1(app_label: str) -> Layer1Result:
    k8s = K8sClient(namespace=settings.k8s_namespace)
    prom = PrometheusClient(settings.prometheus_url)

    crash_loops = k8s.get_crash_loop_count(app_label)
    unready = k8s.get_unready_pod_count(app_label)
    error_rate = prom.error_rate(app_label)

    details = {
        "crash_loop_pods": crash_loops,
        "unready_pods": unready,
        "error_rate": error_rate,
    }

    if crash_loops > 0:
        return Layer1Result(verdict="FAIL", reason="crash_loop_detected", details=details)

    if error_rate is not None and error_rate > settings.error_rate_hard_threshold:
        return Layer1Result(verdict="FAIL", reason="error_rate_hard_breach", details=details)

    if unready == 0 and error_rate is not None and error_rate < settings.error_rate_hard_threshold / 5:
        return Layer1Result(verdict="PASS", reason="all_healthy_signals", details=details)

    # Not clearly good or bad — hand off to Layer 2
    return Layer1Result(verdict="INCONCLUSIVE", reason="borderline_signals", details=details)
