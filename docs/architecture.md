# Architecture

## Flow

```
Deploy triggers → POST /deploy-hook
        │
        ▼
Layer 1 (rules)        crash loops? unready pods? hard error-rate breach?
   PASS  → PROCEED
   FAIL  → ROLLBACK  (subject to safety policy)
   INCONCLUSIVE → Layer 2
        │
        ▼
Layer 2 (stats)         canary metrics vs. historical/stable baseline
   PASS  → PROCEED
   FAIL  → ROLLBACK
   INCONCLUSIVE → Layer 3
        │
        ▼
Layer 3 (AI reasoning)  Claude reads logs + K8s events + git diff + metrics
   returns: status, root_cause, confidence, recommended_action, explanation
        │
        ▼
Decision engine          combines confidence + safety policy
   → PROCEED / ROLLBACK / HUMAN_REVIEW
        │
        ▼
Rollback executor (if ROLLBACK)   kubectl/Argo Rollouts undo → verify recovery
        │
        ▼
Incident report           markdown, saved to DB, viewable via /incidents
```

## Why layered, not "just ask the AI every time"

1. **Cost.** Layer 1/2 checks are free (a few PromQL queries + K8s API
   calls). The LLM call only fires when genuinely needed — most healthy
   deploys never reach Layer 3 at all.
2. **Latency.** Rule checks return in milliseconds. You don't want every
   deploy waiting on an LLM round-trip when a crash loop is already
   obvious from pod status.
3. **Explainability & trust.** Deterministic layers give unambiguous,
   auditable reasons. The AI layer is reserved for the genuinely
   ambiguous cases where its ability to correlate multiple signals and
   explain in plain language actually adds value.
4. **Safety.** Automatic rollback is only triggered when confidence
   crosses a threshold *and* a safety policy (rate limits, freeze
   windows) is satisfied — this prevents a single bad AI call, or a
   flapping metric, from triggering rollback storms.

## Data flow into Layer 3

| Source | What's sent | Why capped |
|---|---|---|
| Loki logs | last 5 min, error-filtered, max 100 lines | keeps prompt small & cheap |
| K8s events | last 30 events for the app | recent context only |
| Prometheus | current snapshot (error rate, p95 latency, CPU) | numeric summary, not raw series |
| Git diff | commit message + diff summary | root-cause correlation |

## Key design decisions

- **Argo Rollouts over plain Deployments** — native canary support
  (weighted traffic split + pause steps) gives compass a natural window
  to evaluate before 100% of traffic shifts.
- **SQLite in dev, Postgres-ready in prod** — `DATABASE_URL` is the only
  thing that changes; SQLAlchemy handles both identically.
- **Claude Haiku for dev, Sonnet for demo/prod** — same prompt, same
  code path, just swap `CLAUDE_MODEL` in `.env`.
- **Structured JSON output from the LLM** — the system prompt forces a
  strict JSON schema so Layer 3's output plugs directly into the
  decision engine without fragile text parsing.

## The hotfix PR flow (opt-in, off by default)

`core/app/fix_generator.py` implements the "Generate Fix → PR" branch
from the original architecture diagram. It's wired into `main.py` but
gated behind several conditions that all must be true before anything
happens:

1. `ENABLE_AUTO_FIX=true` in `.env` — off by default
2. `GITHUB_TOKEN` and `GITHUB_REPO` configured
3. The decision was `ROLLBACK` **and** it was Layer 3 (the AI) that made
   the call — a Layer 1 crash-loop rollback has no "root cause" worth
   handing to a code-fix prompt, so this never fires for those
4. Layer 3's confidence is at or above `AUTO_FIX_MIN_CONFIDENCE` (85 by default)
5. It only ever edits one pre-approved file (`AUTO_FIX_TARGET_FILE`) —
   it cannot touch arbitrary files in your repo
6. The proposed fix passes a basic Python syntax check before anything
   is pushed anywhere

Even when all of that passes, it only ever creates a **new branch**
(`hotfix/<short-sha>-<timestamp>`) and opens a **draft pull request** —
never pushes to `main`, never merges. A human always has to review the
diff and click merge themselves. `GitHubClient.open_pull_request()`
defaults `draft=True` specifically so GitHub's UI won't even offer a
merge button until someone marks it ready for review first.

This is the riskiest part of the system by design — treat it as a
feature to demo deliberately and explain, not something to leave
silently enabled.

## What's deliberately out of scope for the MVP

- The "Generate Fix → PR → re-test" loop (top-left branch of the
  original diagram) — scaffolded in `github_client.py` but not wired
  into the main pipeline. Build this once the core detect→rollback loop
  is solid and demoed.
- A trained ML model for Layer 2 — percentage-deviation is enough for
  v1 and is far easier to explain to a reviewer than a black-box model.
