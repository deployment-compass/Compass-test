"""
Executes the ROLLBACK decision. Supports plain Deployments (kubectl
rollout undo equivalent) or Argo Rollouts, depending on how the demo app
is deployed. Also verifies recovery after rollback (the "Verify Recovery"
step in the flow) instead of assuming success.
"""
import time
from app.clients.k8s_client import K8sClient
from app.clients.prometheus_client import PrometheusClient
from app.config import settings


def execute_rollback(app_label: str, use_argo_rollouts: bool = True) -> dict:
    k8s = K8sClient(namespace=settings.k8s_namespace)

    if use_argo_rollouts:
        success = k8s.rollback_argo_rollout(app_label)
    else:
        success = k8s.rollback_deployment(app_label)

    if not success:
        return {"rollback_triggered": False, "verified": False}

    return {"rollback_triggered": True, **_verify_recovery(app_label)}


def _verify_recovery(app_label: str, wait_seconds: int = 30) -> dict:
    """Wait briefly, then confirm error rate/crash loops have cleared."""
    time.sleep(wait_seconds)
    k8s = K8sClient(namespace=settings.k8s_namespace)
    prom = PrometheusClient(settings.prometheus_url)

    crash_loops = k8s.get_crash_loop_count(app_label)
    error_rate = prom.error_rate(app_label)

    recovered = crash_loops == 0 and (
        error_rate is None or error_rate < settings.error_rate_hard_threshold
    )
    return {
        "verified": recovered,
        "post_rollback_crash_loops": crash_loops,
        "post_rollback_error_rate": error_rate,
    }
