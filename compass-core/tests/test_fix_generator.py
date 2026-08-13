"""
These tests focus entirely on the SAFETY GATES, not on mocking the full
GitHub/Anthropic API round-trip -- the thing most worth verifying here
is that the risky path stays off unless every condition is explicitly met.
"""
from app.fix_generator import generate_and_open_hotfix_pr, _looks_like_valid_python
from app.config import settings


def test_disabled_by_default():
    assert settings.enable_auto_fix is False


def test_refuses_to_run_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "enable_auto_fix", False)
    result = generate_and_open_hotfix_pr(
        root_cause="null pointer in payment handler",
        evidence_summary={},
        commit_sha="abc1234",
    )
    assert result["attempted"] is False
    assert "ENABLE_AUTO_FIX" in result["reason"]


def test_refuses_to_run_without_github_config(monkeypatch):
    monkeypatch.setattr(settings, "enable_auto_fix", True)
    monkeypatch.setattr(settings, "github_token", "")
    result = generate_and_open_hotfix_pr(
        root_cause="null pointer in payment handler",
        evidence_summary={},
        commit_sha="abc1234",
    )
    assert result["attempted"] is False
    assert "GITHUB_TOKEN" in result["reason"] or "GITHUB_REPO" in result["reason"]


def test_valid_python_check_passes_good_code():
    assert _looks_like_valid_python("def foo():\n    return 1\n") is True


def test_valid_python_check_catches_syntax_error():
    assert _looks_like_valid_python("def foo(:\n    return 1\n") is False
