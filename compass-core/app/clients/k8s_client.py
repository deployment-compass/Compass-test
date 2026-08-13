"""
Thin wrapper around the Kubernetes Python client. Only exposes exactly
what Layer 1 and the rollback executor need — keeps the rest of the
codebase from needing to know about K8s API internals.
"""
from kubernetes import client, config as k8s_config
from kubernetes.client.rest import ApiException


class K8sClient:
    def __init__(self, namespace: str = "default"):
        self.namespace = namespace
        try:
            k8s_config.load_incluster_config()   # running inside the cluster
        except Exception:
            k8s_config.load_kube_config()        # running locally via kubeconfig
        self.core = client.CoreV1Api()
        self.apps = client.AppsV1Api()

    def get_crash_loop_count(self, app_label: str) -> int:
        """Count pods for this app currently in CrashLoopBackOff."""
        pods = self.core.list_namespaced_pod(
            self.namespace, label_selector=f"app={app_label}"
        )
        count = 0
        for pod in pods.items:
            for cs in pod.status.container_statuses or []:
                waiting = cs.state.waiting
                if waiting and waiting.reason == "CrashLoopBackOff":
                    count += 1
        return count

    def get_restart_count(self, app_label: str) -> int:
        pods = self.core.list_namespaced_pod(
            self.namespace, label_selector=f"app={app_label}"
        )
        return sum(
            cs.restart_count
            for pod in pods.items
            for cs in (pod.status.container_statuses or [])
        )

    def get_unready_pod_count(self, app_label: str) -> int:
        pods = self.core.list_namespaced_pod(
            self.namespace, label_selector=f"app={app_label}"
        )
        unready = 0
        for pod in pods.items:
            ready = all(
                cs.ready for cs in (pod.status.container_statuses or [])
            )
            if not ready:
                unready += 1
        return unready

    def get_recent_events(self, app_label: str, limit: int = 30) -> list[dict]:
        """Recent K8s events (warnings especially) for this app's pods."""
        events = self.core.list_namespaced_event(self.namespace)
        relevant = [
            {
                "reason": e.reason,
                "message": e.message,
                "type": e.type,
                "count": e.count,
                "last_timestamp": str(e.last_timestamp),
            }
            for e in events.items
            if e.involved_object and app_label in (e.involved_object.name or "")
        ]
        relevant.sort(key=lambda x: x["last_timestamp"], reverse=True)
        return relevant[:limit]

    def rollback_deployment(self, deployment_name: str) -> bool:
        """
        Plain-Deployment rollback via API (equivalent of `kubectl rollout undo`).
        If you're using Argo Rollouts instead, use rollback_argo_rollout() below.
        """
        try:
            self.apps.patch_namespaced_deployment(
                name=deployment_name,
                namespace=self.namespace,
                body={"spec": {"rollbackTo": {"revision": 0}}},
            )
            return True
        except ApiException as e:
            print(f"Rollback failed: {e}")
            return False

    def rollback_argo_rollout(self, rollout_name: str) -> bool:
        """
        Argo Rollouts uses a CRD, not the native Deployment rollback API.
        This calls `kubectl argo rollouts undo` equivalent via the custom
        objects API. In practice, many teams just shell out to the argo
        rollouts CLI/kubectl-argo-rollouts plugin from here for simplicity.
        """
        import subprocess
        result = subprocess.run(
            ["kubectl", "argo", "rollouts", "undo", rollout_name,
             "-n", self.namespace],
            capture_output=True, text=True,
        )
        return result.returncode == 0
