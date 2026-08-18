# Local Setup (free, runs entirely on your laptop)

## 0. Prerequisites

```bash
# macOS
brew install docker kind kubectl helm

# Or on Linux, follow each tool's install docs — all free/OSS:
# docker: https://docs.docker.com/engine/install/
# kind:   https://kind.sigs.k8s.io/docs/user/quick-start/
# kubectl: https://kubernetes.io/docs/tasks/tools/
# helm:   https://helm.sh/docs/intro/install/
```

You'll also want a free [Anthropic API key](https://console.anthropic.com).

## 1. Spin up the cluster

```bash
cd infra/scripts
./setup-cluster.sh
```

This creates a local kind cluster called `compass-demo`. No cloud account, no cost.

## 2. Install monitoring (Prometheus + Grafana + Loki)

```bash
./install-monitoring.sh
```

Takes 1-2 minutes. Verify:
```bash
kubectl -n monitoring get pods
```

## 3. Install Argo Rollouts

```bash
./install-argo-rollouts.sh
```

## 4. Build and deploy the demo app

The demo app itself lives at `infra/demo-app/app/main.py` — a small
instrumented Flask app exposing `/healthz` (readiness) and `/metrics`
(Prometheus scrape target). Build it and load it straight into the kind
cluster (no registry needed, completely free):

```bash
./build-demo-app.sh
```

Then deploy the app **and** the `ServiceMonitor` that tells Prometheus
where to scrape it:

```bash
kubectl apply -f ../demo-app/rollout.yaml
kubectl apply -f ../demo-app/servicemonitor.yaml
kubectl argo rollouts get rollout demo-app --watch
```

**How Prometheus finds this app's `/metrics` endpoint** (the discovery
chain, in order):
```
Pod (label app=demo-app, container port 8080, serves /metrics)
  → Service "demo-app" (selects pods by app=demo-app, exposes named port "http" → 8080)
    → ServiceMonitor "demo-app" (selects the Service by app=demo-app,
       tells Prometheus Operator: scrape port "http" at /metrics every 15s)
      → Prometheus Operator watches ServiceMonitors cluster-wide and
         auto-generates the real scrape config — you never hand-edit
         prometheus.yml directly.
```

Verify Prometheus actually picked it up:
```bash
kubectl -n monitoring port-forward svc/kube-prometheus-kube-prome-prometheus 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | grep -A2 '"job":"default/demo-app"'
```
You should see the target listed with `"health":"up"`. If it's missing,
double-check `install-monitoring.sh` ran with
`serviceMonitorSelectorNilUsesHelmValues=false` (see that script's
comments) — that's the setting that lets Prometheus discover
ServiceMonitors outside its own Helm release label.

## 5. Port-forward the observability backends

Open three terminals:

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-kube-prome-prometheus 9090:9090
kubectl -n monitoring port-forward svc/loki 3100:3100
kubectl -n monitoring port-forward svc/kube-prometheus-grafana 3000:80   # optional, for dashboards
```

## 6. Where compass' own API lives

There are two ways to run the orchestrator — pick one for now, they're
not mutually exclusive later.

**Mode A — local process (what the rest of this doc assumes).**
Runs on your laptop, not inside the cluster:
```bash
cd core
cp .env.example .env
# edit .env and paste in your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3000
```
Check it's alive: `curl http://localhost:3000/health`

It reaches the cluster via your local `kubeconfig` and the port-forwards
from step 5. This is the right mode while you're actively iterating on
`core/app/*.py`, since you get `--reload` instead of a rebuild cycle.

**Mode B — running inside the cluster** (`infra/compass-core/`).
Gives compass a stable in-cluster address —
`http://compass-core.default.svc.cluster.local:3000` — that other
in-cluster things (an Argo CD PostSync hook, for example) can call
directly, and uses the in-cluster ServiceAccount instead of your local
kubeconfig:
```bash
cd infra/scripts
./build-compass-core.sh
kubectl create secret generic compass-core-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-your-real-key \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f ../compass-core/deployment.yaml
kubectl get pods -l app=compass-core
```

**The one real constraint, stated plainly:** a local `kind` cluster is
not reachable from the public internet. If you deploy compass in Mode B
and want `.github/workflows/deploy.yml` (which runs on GitHub's own
servers, outside your machine) to reach it, you have three honest
options:
1. **Demo/dev only:** run a free tunnel like `ngrok http 3000` (Mode A) or
   port-forward `svc/compass-core` (Mode B) and put the temporary public
   URL in the `compass_URL` GitHub secret. Fine for demos, not durable.
2. **Trigger from inside the cluster instead of from GitHub Actions** —
   e.g. an Argo CD `PostSync` hook calling the in-cluster Service DNS
   name directly. This sidesteps the reachability problem entirely and
   is the more "correct" production pattern.
3. **Real cloud cluster:** once you move off `kind` to EKS/GKE/AKS,
   expose `compass-core` via an Ingress or LoadBalancer with a real DNS
   name, and CI can reach it like any other internet endpoint.

For local development and demoing the detect→rollback loop by hand
(steps 7-9 below), you don't need any of this — Mode A on `localhost`
is all you need.

## 7. Trigger a deploy event manually (simulating what CI would send)

```bash
curl -X POST http://localhost:3000/deploy-hook \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "demo-app",
    "namespace": "default",
    "new_revision": "v2",
    "previous_revision": "v1",
    "commit_sha": "abc1234",
    "commit_message": "Fix payment retry logic",
    "triggered_by": "you"
  }'
```

Watch the response — it'll tell you which layer decided, what action was
taken, and give you the full markdown incident report.

## 8. Simulate a bad deploy (to see rollback fire)

Deliberately break the demo app (e.g. push an image that crashes on
startup, or inject a fake 500-error endpoint) and redeploy. Watch:

```bash
kubectl get pods -w                          # see the crash loop / unready pods
# then hit /deploy-hook again and watch compass catch it and roll back
```

## 9. View incident history

```bash
curl http://localhost:3000/incidents
```

## 10. Run the tests

```bash
cd core
pytest tests/ -v
```

## Cost checklist

| Item | Cost |
|---|---|
| kind cluster | $0 (local Docker) |
| Prometheus/Grafana/Loki | $0 (self-hosted in-cluster) |
| Argo Rollouts | $0 (OSS) |
| GitHub Actions | $0 (free tier, way under 2000 min/month) |
| SQLite | $0 |
| Claude API (Haiku, dev) | ~$0.001-0.01 per Layer-3 call — a few dollars total for weeks of iteration |

Set a hard spend cap in the [Anthropic Console](https://console.anthropic.com)
under billing limits so you never get a surprise bill while testing.

## Tearing down

```bash
kind delete cluster --name compass-demo
```
