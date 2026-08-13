# Production Architecture

This document describes what compass looks like as a **real, deployed
system** — as distinct from `docs/setup.md`, which covers the free,
local `kind`-cluster version used for development and demos. Read this
after you've got the local version working.

## The full path

```
Developer
   │ git push
   ▼
GitHub
   │
   ▼
GitHub Actions (CI)
   │ builds Docker image, pushes to registry
   ▼
Image Registry (ECR / GHCR / etc.)
   │
   ▼
Argo CD  ──(GitOps sync — cluster state always matches Git)──┐
                                                              │
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Kubernetes cluster (EKS / GKE / AKS)                      │
│                                                                   │
│   Argo Rollouts  ──canary release──▶  Your App (pods + Service)  │
│         │                                    │                   │
│         │                          ┌─────────┴─────────┐         │
│         │                          ▼                   ▼         │
│         │                    Prometheus            Loki (logs)   │
│         │                          │                   │         │
│         │                          ▼                   ▼         │
│         │                        compass (3 layers + decision)   │
│         │◀───rolls back if unhealthy───────────┘                 │
│                                     │                             │
│                              Ingress (public HTTPS)                │
└──────────────────────────────────┬────────────────────────────────┘
                                    │
                    GitHub Actions calls compass here
                    (https://compass.yourcompany.com)

compass also talks OUTSIDE the cluster to:
  → Claude API (Anthropic) — Layer 3 reasoning
  → Managed Postgres — incident history
  → Slack — human notifications
```

## What changes vs. the local (`kind`) setup

| Piece | Local (`docs/setup.md`) | Production |
|---|---|---|
| Kubernetes | `kind` on your laptop, free | Real cloud cluster (EKS/GKE/AKS) — costs money |
| Image storage | `kind load docker-image`, no registry | Real registry (ECR/GHCR) |
| Deploying new versions | You run `kubectl apply` by hand | Argo CD watches Git and syncs automatically |
| Reaching compass from CI | Not possible without a tunnel (kind isn't public) | Ingress with a real domain + TLS certificate |
| Incident storage | SQLite file in the pod | Managed Postgres (survives pod restarts, queryable, backed up) |
| Secrets (API keys) | `.env` file / a plain `Secret` object | A real secrets manager (AWS Secrets Manager, GCP Secret Manager, or Sealed Secrets) |
| Notifications | None — you check `/incidents` manually | Slack webhook on every ROLLBACK / HUMAN_REVIEW |

## Why each new piece exists

- **Image registry** — a shelf to store built versions of your app so the cluster can pull them. `kind load docker-image` was a local-only shortcut; real clusters can't reach your laptop's Docker.
- **Argo CD** — without it, someone has to remember to run `kubectl apply` every time code changes. Argo CD makes Git the single source of truth: merge a PR, the cluster updates itself.
- **Ingress + real domain** — this is what solves the "GitHub Actions can't reach my laptop" problem from earlier in this conversation. A real cloud cluster has a public IP; Ingress maps a domain name to the right internal Service (`compass-core`) with a TLS certificate for HTTPS.
- **Managed Postgres instead of SQLite** — SQLite is a single file inside one pod. If that pod restarts, you could lose incident history unless it's on a persistent disk. A managed database survives that and lets multiple people query incident history at once.
- **A real secrets manager** — an `ANTHROPIC_API_KEY` sitting in plain text in a Git-tracked file (even a K8s `Secret` manifest) is a leak waiting to happen. Production systems fetch secrets from a dedicated, audited service instead.
- **Slack notifications** — nobody should have to remember to check `/incidents`. A HUMAN_REVIEW decision should page someone.

## What does NOT change

The actual logic — `core/app/layer1_rules.py`, `layer2_stats.py`,
`layer3_llm.py`, `decision.py`, `rollback.py` — is identical in both
environments. This is intentional: the whole point of the layered
architecture and the `config.py` settings pattern is that moving from
local to production is a matter of changing environment variables and
infrastructure around the code, not rewriting the code itself.

## Doing this for real on EKS

The pieces described above now exist as real files in this repo:

```bash
# 1. Create the actual AWS EKS cluster (~15-20 min, starts billing immediately)
cd infra/eks
./setup-eks.sh

# 2. Install Argo CD
cd ../argocd
./install-argocd.sh

# 3. Point Argo CD at your repo (edit repoURL in both files first)
kubectl apply -f application-demo-app.yaml
kubectl apply -f application-compass-core.yaml

# 4. Create the compass secret (never goes through GitOps in plain text)
kubectl create secret generic compass-core-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-your-real-key \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Expose compass publicly
kubectl apply -f ../compass-core/ingress.yaml
kubectl get ingress compass-core   # copy the ALB address, point your DNS at it

# 6. Tear down when done (stops billing)
cd ../eks
./teardown-eks.sh
```

| File | Purpose |
|---|---|
| `infra/eks/cluster.yaml` | eksctl config defining the actual EKS cluster + node group |
| `infra/eks/setup-eks.sh` | Creates the cluster + installs the AWS Load Balancer Controller (what makes Ingress work) |
| `infra/eks/teardown-eks.sh` | Deletes everything — run this to stop being billed |
| `infra/argocd/install-argocd.sh` | Installs Argo CD itself into the cluster |
| `infra/argocd/application-*.yaml` | Tells Argo CD which Git paths to watch and auto-sync |
| `infra/compass-core/ingress.yaml` | The real public HTTPS front door — this is what solves the "GitHub can't reach my laptop" problem |

| Item | Typical cost |
|---|---|
| Small managed K8s cluster (e.g. 2-3 small nodes) | $50–150/mo |
| Managed Postgres (smallest tier) | $10–25/mo |
| Load balancer / Ingress | $15–20/mo |
| Claude API usage | Usage-based — depends on deploy volume; a few dollars to tens of dollars/mo for moderate traffic |
| Image registry | Often free tier is enough |

This is normal for any real production service — it's the cost of
running something reliably for other people to depend on, not a sign
you're doing something wrong. The free, local version is for building
and demoing; this is for when the project needs to run for real, all
the time, without your laptop being on.
