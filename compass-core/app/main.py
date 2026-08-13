"""
compass orchestrator entrypoint. GitHub Actions / Argo CD calls
POST /deploy-hook after a deployment lands; this runs the full
Layer 1 -> 2 -> 3 -> Decision -> Rollback -> Report pipeline.
"""
from fastapi import FastAPI
from app.models import DeploymentEvent, IncidentReport
from app.layer1_rules import run_layer1
from app.layer2_stats import run_layer2
from app.layer3_llm import run_layer3
from app.decision import decide
from app.rollback import execute_rollback
from app.incident_report import build_report, save_report
from app.fix_generator import generate_and_open_hotfix_pr
from app.config import settings

app = FastAPI(title="compass", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/deploy-hook", response_model=IncidentReport)
def deploy_hook(event: DeploymentEvent):
    app_label = event.app_name

    # Layer 1 — always runs
    layer1 = run_layer1(app_label)
    layer2 = None
    layer3 = None

    # Layer 2 only if Layer 1 couldn't decide
    if layer1.verdict == "INCONCLUSIVE":
        layer2 = run_layer2(app_label, baseline_app_label=f"{app_label}-stable")

        # Layer 3 only if Layer 2 also couldn't decide
        if layer2.verdict == "INCONCLUSIVE":
            layer3 = run_layer3(
                app_label=app_label,
                commit_message=event.commit_message or "",
                diff_summary=f"commit {event.commit_sha}",
            )

    decision = decide(layer1, layer2, layer3)

    rollback_result = None
    if decision.action == "ROLLBACK":
        rollback_result = execute_rollback(app_label)

    # Hotfix PR: only attempted when the AI (Layer 3) is the one that made
    # the call, with a specific root cause and high confidence. A Layer 1
    # crash-loop rollback has no "root cause" worth handing to a code-fix
    # prompt, so this deliberately never fires for those.
    fix_result = None
    if (
        decision.action == "ROLLBACK"
        and decision.decided_by_layer == 3
        and layer3 is not None
        and layer3.confidence >= settings.auto_fix_min_confidence
    ):
        fix_result = generate_and_open_hotfix_pr(
            root_cause=layer3.root_cause,
            evidence_summary=layer3.evidence_summary,
            commit_sha=event.commit_sha,
        )

    report = build_report(event, layer1, decision, layer2, layer3, hotfix=fix_result)
    save_report(report)

    return report


@app.get("/incidents")
def list_incidents(limit: int = 20):
    from app.incident_report import SessionLocal, IncidentRecord
    session = SessionLocal()
    try:
        records = (
            session.query(IncidentRecord)
            .order_by(IncidentRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id, "app_name": r.app_name, "commit_sha": r.commit_sha,
                "action": r.action, "confidence": r.confidence,
                "root_cause": r.root_cause, "created_at": r.created_at.isoformat(),
            }
            for r in records
        ]
    finally:
        session.close()
