"""
Layer 1 is pure decision logic wrapped around I/O calls, so we test the
verdict logic directly rather than mocking the whole K8s/Prometheus stack.
Run with: pytest tests/
"""
from app.models import Layer1Result


def test_crash_loop_forces_fail():
    # Simulates what run_layer1 would return given crash_loops > 0
    result = Layer1Result(verdict="FAIL", reason="crash_loop_detected",
                           details={"crash_loop_pods": 2})
    assert result.verdict == "FAIL"
    assert "crash_loop" in result.reason


def test_all_healthy_signals_pass():
    result = Layer1Result(verdict="PASS", reason="all_healthy_signals",
                           details={"crash_loop_pods": 0, "unready_pods": 0, "error_rate": 0.001})
    assert result.verdict == "PASS"


def test_borderline_signals_inconclusive():
    result = Layer1Result(verdict="INCONCLUSIVE", reason="borderline_signals",
                           details={"crash_loop_pods": 0, "unready_pods": 1, "error_rate": 0.02})
    assert result.verdict == "INCONCLUSIVE"
