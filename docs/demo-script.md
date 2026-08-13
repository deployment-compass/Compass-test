# Hackathon Live Demo Script

Total run time: ~4 minutes. Rehearse this exact sequence at least 3
times before presenting — the goal is that your hands know it even if
you're nervous.

## Before judges arrive (setup, do this once, off-stage)

```bash
cd infra/scripts
./setup-cluster.sh
./install-monitoring.sh
./install-argo-rollouts.sh
./build-demo-app.sh
kubectl apply -f ../demo-app/rollout.yaml
kubectl apply -f ../demo-app/servicemonitor.yaml

# In separate terminals, leave these running the whole time:
kubectl -n monitoring port-forward svc/kube-prometheus-kube-prome-prometheus 9090:9090
kubectl -n monitoring port-forward svc/loki 3100:3100
kubectl -n monitoring port-forward svc/kube-prometheus-grafana 3000:80
kubectl port-forward svc/demo-app 8080:80

cd ../../core
cp .env.example .env   # paste in your real ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Open two browser tabs ahead of time:
- Grafana: `http://localhost:3000` (admin/admin) → the "compass — demo-app" dashboard
- A terminal with `watch -n2 curl -s http://localhost:8000/incidents` running, so incidents appear live

## The live sequence (on stage)

**[0:00] Set the scene (30 sec)**
> "Modern teams deploy multiple times a day. When something breaks, someone
> has to manually dig through logs and dashboards to figure out why —
> that takes time, and it's the same story every incident. compass
> automates that: it watches every deploy, and when something looks
> wrong, an AI reads the evidence, explains what happened, and can
> roll it back automatically."

**[0:30] Show the healthy state (30 sec)**
Point at the Grafana dashboard — error rate flat near zero, requests flowing.
> "Right now the app is healthy. Error rate's near zero, latency's stable."

**[1:00] Trigger the failure — THE moment (15 sec)**
```bash
curl -X POST http://localhost:8080/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{"failure_rate": 0.6}'
```
> "I'm simulating a bad deploy right now — no rebuild, just flipping a
> switch, the way a real bug would start showing up in production."

**[1:15] Point at Grafana reacting (20 sec)**
Error rate panel climbs in near-real-time.
> "You can already see the error rate climbing on the dashboard.
> A human on-call engineer would be starting to dig through logs right
> about now."

**[1:35] Trigger the compass check (10 sec)**
```bash
curl -X POST http://localhost:8000/deploy-hook \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "demo-app", "namespace": "default",
    "new_revision": "v2", "previous_revision": "v1",
    "commit_sha": "demo123", "commit_message": "Simulated bad deploy for hackathon demo",
    "triggered_by": "live-demo"
  }'
```

**[1:45] Narrate the response as it comes back (30 sec)**
Read the JSON response out loud, pointing at the key fields:
> "Layer 1 caught the hard error-rate breach immediately — see, it
> didn't even need to call the AI for this one. Decision: ROLLBACK.
> It's already triggered the rollback and verified recovery."

**[2:15] Show the incident report (20 sec)**
```bash
curl -s http://localhost:8000/incidents | python3 -m json.tool
```
> "And here's the auto-generated incident report — this is what used
> to take an engineer 30-45 minutes to reconstruct after the fact.
> Now it's written the moment the decision is made."

**[2:35] Show the harder case — AI reasoning (60 sec)**
```bash
curl -X POST http://localhost:8080/admin/chaos -d '{"failure_rate": 0.15}'
```
> "Now let me show the more interesting case — a subtler problem that
> doesn't cleanly breach a hard threshold. This is where Layers 1 and 2
> can't confidently decide, so it escalates to Claude, which reads the
> actual logs and explains what it thinks is happening in plain English."
Trigger `/deploy-hook` again, read the `layer3.explanation` field aloud.

**[3:35] Reset and close (25 sec)**
```bash
curl -X POST http://localhost:8080/admin/reset
```
> "That's compass — rules for the obvious cases, statistics for subtle
> drift, and AI reasoning only when it's genuinely needed, which keeps
> it fast and cheap. It's also fully explainable — every decision has a
> written reason, not a black box."

## If something breaks live

Have this ready as backup, tested beforehand:
- A screen recording of the sequence above, in case Wi-Fi or a
  port-forward flakes. Judges respect "here's the backup recording"
  far more than a dead terminal eating your time slot.
- `curl http://localhost:8000/health` as your first command if anything
  seems off — confirms compass itself is alive before debugging further.

## What NOT to demo live

Do not attempt to demo the EKS/Argo CD path live — cluster creation
alone takes 15-20 minutes and depends on conference Wi-Fi and AWS being
cooperative, neither of which you control on stage. Mention it as
"here's how this becomes production" on a slide with the architecture
diagram instead. The local `kind` demo above is faster, free, and 100%
reliable — that reliability is worth more to your score than showing a
real cloud cluster.
