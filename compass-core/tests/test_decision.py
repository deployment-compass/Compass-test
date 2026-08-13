from app.models import Layer1Result, Layer2Result, Layer3Result
from app.decision import decide


def test_layer1_pass_proceeds():
    d = decide(Layer1Result(verdict="PASS", reason="ok"))
    assert d.action == "PROCEED"
    assert d.decided_by_layer == 1


def test_layer1_fail_rolls_back():
    d = decide(Layer1Result(verdict="FAIL", reason="crash_loop_detected"))
    assert d.action == "ROLLBACK"
    assert d.decided_by_layer == 1


def test_layer3_high_confidence_rollback():
    l1 = Layer1Result(verdict="INCONCLUSIVE", reason="borderline")
    l2 = Layer2Result(verdict="INCONCLUSIVE", reason="moderate_deviation")
    l3 = Layer3Result(
        status="failing", root_cause="NullPointerException in payment handler",
        confidence=90, recommended_action="ROLLBACK",
        explanation="New commit introduces a null check bug causing 500s.",
    )
    d = decide(l1, l2, l3)
    assert d.action == "ROLLBACK"
    assert d.decided_by_layer == 3


def test_layer3_low_confidence_escalates_to_human():
    l1 = Layer1Result(verdict="INCONCLUSIVE", reason="borderline")
    l2 = Layer2Result(verdict="INCONCLUSIVE", reason="moderate_deviation")
    l3 = Layer3Result(
        status="degraded", root_cause="Possibly related to increased traffic",
        confidence=30, recommended_action="ROLLBACK",
        explanation="Some signal of degradation but not clearly tied to the new commit.",
    )
    d = decide(l1, l2, l3)
    assert d.action == "HUMAN_REVIEW"


def test_all_inconclusive_never_guesses():
    l1 = Layer1Result(verdict="INCONCLUSIVE", reason="borderline")
    d = decide(l1)
    assert d.action == "HUMAN_REVIEW"
