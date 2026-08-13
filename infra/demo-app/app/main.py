"""
This is the actual application compass monitors — a deliberately trivial
Flask app whose ONLY job is to expose the three things Layer 1/2/3 need:

  GET /healthz   -> readiness probe target (used by K8s + Layer 1)
  GET /work      -> a "business" endpoint with configurable latency/error
                     rate, so you can simulate good vs. bad deploys
  GET /metrics   -> Prometheus scrape target (text exposition format)

Metrics are labeled with app="demo-app" directly (via APP_NAME env var)
so the PromQL queries in core/app/clients/prometheus_client.py
(e.g. http_requests_total{app="demo-app",status=~"5.."}) resolve correctly
without needing relabeling tricks in Prometheus.

FAILURE_RATE and LATENCY_MS_BASE are env vars — bump FAILURE_RATE to
simulate a bad deploy without changing code, which is exactly what you'll
do to trigger compass' rollback path in a demo.
"""
import os
import random
import time
from flask import Flask, Response
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

app = Flask(__name__)

APP_NAME = os.environ.get("APP_NAME", "demo-app")

# NOTE: these are mutable module-level state, not frozen at startup.
# /admin/chaos below changes them live -- this is what makes a hackathon
# demo reliable: no rebuild, no redeploy, just one curl command and
# compass reacts within its soak window.
state = {
    "failure_rate": float(os.environ.get("FAILURE_RATE", "0.0")),   # 0.0 = healthy, 0.3 = 30% of requests 500
    "latency_ms_base": int(os.environ.get("LATENCY_MS_BASE", "20")),
    "latency_ms_jitter": int(os.environ.get("LATENCY_MS_JITTER", "30")),
}

# --- Prometheus metrics, labeled with app= so PromQL filters match ---
REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests",
    ["app", "method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "Request latency in seconds",
    ["app", "endpoint"],
)


@app.route("/healthz")
def healthz():
    """Readiness/liveness probe target. Always cheap and fast."""
    return {"status": "ok", "app": APP_NAME}, 200


@app.route("/work")
def work():
    """
    Simulated business endpoint. Latency and failure rate are live-
    controllable via /admin/chaos -- see below -- so you can 'deploy a
    bad version' during a live demo with one curl command, no rebuild.
    """
    start = time.time()
    delay = (state["latency_ms_base"] + random.randint(0, state["latency_ms_jitter"])) / 1000
    time.sleep(delay)

    failed = random.random() < state["failure_rate"]
    status = "500" if failed else "200"

    REQUEST_LATENCY.labels(app=APP_NAME, endpoint="/work").observe(time.time() - start)
    REQUEST_COUNT.labels(app=APP_NAME, method="GET", endpoint="/work", status=status).inc()

    if failed:
        return {"error": "simulated internal failure"}, 500
    return {"status": "ok", "app": APP_NAME}, 200


@app.route("/admin/chaos", methods=["POST"])
def set_chaos():
    """
    ★ THE DEMO BUTTON. During a live demo, run:

      curl -X POST http://localhost:8080/admin/chaos \\
        -H "Content-Type: application/json" \\
        -d '{"failure_rate": 0.4}'

    Traffic to /work immediately starts failing ~40% of the time.
    Nothing needs to be rebuilt or redeployed -- Prometheus picks up the
    new error rate on its next scrape (within ~15s), and compass catches
    it on its next /deploy-hook check. This is what makes a live rollback
    demo fast and reliable instead of a multi-minute rebuild-and-pray.
    """
    from flask import request
    body = request.get_json(force=True, silent=True) or {}

    if "failure_rate" in body:
        state["failure_rate"] = max(0.0, min(1.0, float(body["failure_rate"])))
    if "latency_ms_base" in body:
        state["latency_ms_base"] = int(body["latency_ms_base"])

    return {"status": "updated", "current_state": state}, 200


@app.route("/admin/reset", methods=["POST"])
def reset_chaos():
    """One-command 'undo' -- resets to healthy defaults between demo runs
    or rehearsals, without restarting the pod."""
    state["failure_rate"] = 0.0
    state["latency_ms_base"] = 20
    state["latency_ms_jitter"] = 30
    return {"status": "reset", "current_state": state}, 200


@app.route("/metrics")
def metrics():
    """Prometheus scrapes this endpoint on the interval set in servicemonitor.yaml."""
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
