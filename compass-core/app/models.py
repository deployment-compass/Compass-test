"""
Shared data models passed between layers. Keeping these as explicit
Pydantic models (rather than raw dicts) makes each layer's contract
obvious and gives you free validation + easy JSON serialization for
the incident report / API responses.
"""
from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel


class DeploymentEvent(BaseModel):
    """What GitHub Actions / Argo CD posts to /deploy-hook."""
    app_name: str
    namespace: str = "default"
    new_revision: str          # e.g. git SHA or image tag
    previous_revision: str
    commit_sha: str
    commit_message: Optional[str] = None
    triggered_by: Optional[str] = None


LayerVerdict = Literal["PASS", "FAIL", "INCONCLUSIVE"]
Action = Literal["PROCEED", "ROLLBACK", "HUMAN_REVIEW"]


class Layer1Result(BaseModel):
    verdict: LayerVerdict
    reason: Optional[str] = None
    details: dict = {}


class Layer2Result(BaseModel):
    verdict: LayerVerdict
    deviation_score: Optional[float] = None
    metrics_compared: dict = {}
    reason: Optional[str] = None


class Layer3Result(BaseModel):
    status: Literal["healthy", "degraded", "failing", "unknown"]
    root_cause: str
    confidence: int            # 0-100
    recommended_action: Action
    explanation: str
    evidence_summary: dict = {}


class DecisionResult(BaseModel):
    action: Action
    decided_by_layer: int       # which layer produced the final call
    confidence: Optional[int] = None
    reason: str


class IncidentReport(BaseModel):
    deployment: DeploymentEvent
    layer1: Layer1Result
    layer2: Optional[Layer2Result] = None
    layer3: Optional[Layer3Result] = None
    decision: DecisionResult
    hotfix: Optional[dict] = None
    markdown: str
