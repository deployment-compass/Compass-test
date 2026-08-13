"""
Combines the outputs of Layers 1-3 into one final action, and applies a
safety policy on top of raw confidence — this is the "predefined safety
policies" gate mentioned in the design doc. Rollback is only ever
automatic when BOTH the confidence threshold and the safety policy pass;
otherwise it's escalated to a human rather than guessed at.
"""
from datetime import datetime, time
from app.models import Layer1Result, Layer2Result, Layer3Result, DecisionResult
from app.config import settings

# Example safety policy: no automatic rollbacks during a change freeze
# window, and never more than N auto-rollbacks per hour (rate limit guard
# against a flapping/bad Layer 3 verdict causing repeated rollbacks).
_recent_auto_rollbacks: list[datetime] = []
MAX_AUTO_ROLLBACKS_PER_HOUR = 3
FREEZE_WINDOW = None  # e.g. (time(22, 0), time(6, 0)) to block overnight auto-rollbacks


def _safety_policy_ok() -> bool:
    now = datetime.utcnow()
    if FREEZE_WINDOW:
        start, end = FREEZE_WINDOW
        current = now.time()
        in_freeze = (start <= current or current <= end) if start > end else (start <= current <= end)
        if in_freeze:
            return False

    global _recent_auto_rollbacks
    _recent_auto_rollbacks = [t for t in _recent_auto_rollbacks if (now - t).seconds < 3600]
    if len(_recent_auto_rollbacks) >= MAX_AUTO_ROLLBACKS_PER_HOUR:
        return False

    return True


def _record_auto_rollback():
    _recent_auto_rollbacks.append(datetime.utcnow())


def decide(
    layer1: Layer1Result,
    layer2: Layer2Result | None = None,
    layer3: Layer3Result | None = None,
) -> DecisionResult:
    # Layer 1 gives a confident verdict on its own
    if layer1.verdict == "FAIL":
        if _safety_policy_ok():
            _record_auto_rollback()
            return DecisionResult(action="ROLLBACK", decided_by_layer=1,
                                   reason=f"Layer 1 hard failure: {layer1.reason}")
        return DecisionResult(action="HUMAN_REVIEW", decided_by_layer=1,
                               reason=f"Layer 1 flagged failure but safety policy blocked auto-rollback: {layer1.reason}")

    if layer1.verdict == "PASS":
        return DecisionResult(action="PROCEED", decided_by_layer=1,
                               reason="All Layer 1 checks passed")

    # Layer 1 inconclusive -> check Layer 2
    if layer2:
        if layer2.verdict == "FAIL":
            if _safety_policy_ok():
                _record_auto_rollback()
                return DecisionResult(action="ROLLBACK", decided_by_layer=2,
                                       confidence=None,
                                       reason=f"Layer 2 significant deviation from baseline: {layer2.reason}")
            return DecisionResult(action="HUMAN_REVIEW", decided_by_layer=2,
                                   reason="Layer 2 flagged failure but safety policy blocked auto-rollback")
        if layer2.verdict == "PASS":
            return DecisionResult(action="PROCEED", decided_by_layer=2,
                                   reason="Layer 2 within normal statistical range")

    # Layer 2 inconclusive too -> Layer 3 (AI) has the final say
    if layer3:
        if layer3.recommended_action == "ROLLBACK":
            if layer3.confidence >= settings.rollback_confidence_threshold and _safety_policy_ok():
                _record_auto_rollback()
                return DecisionResult(action="ROLLBACK", decided_by_layer=3,
                                       confidence=layer3.confidence,
                                       reason=f"AI diagnosis (confidence {layer3.confidence}%): {layer3.root_cause}")
            return DecisionResult(action="HUMAN_REVIEW", decided_by_layer=3,
                                   confidence=layer3.confidence,
                                   reason=f"AI suspects failure but confidence below threshold or safety policy blocked: {layer3.root_cause}")

        if layer3.recommended_action == "PROCEED" and layer3.confidence >= settings.rollback_confidence_threshold:
            return DecisionResult(action="PROCEED", decided_by_layer=3,
                                   confidence=layer3.confidence,
                                   reason="AI analysis found no significant issues")

        return DecisionResult(action="HUMAN_REVIEW", decided_by_layer=3,
                               confidence=layer3.confidence,
                               reason=f"AI uncertain: {layer3.explanation}")

    # Nothing could decide -> escalate, never guess
    return DecisionResult(action="HUMAN_REVIEW", decided_by_layer=0,
                           reason="All layers inconclusive; escalating to human")
