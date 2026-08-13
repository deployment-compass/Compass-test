"""
Centralized configuration. Loaded from environment variables / .env file.
Nothing here is hardcoded — this is what you tune per environment
(local kind cluster, staging, prod) without touching code.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic
    anthropic_api_key: str = ""
    claude_model: str = "claude-haiku-4-5"

    # Observability backends
    prometheus_url: str = "http://localhost:9090"
    loki_url: str = "http://localhost:3100"

    # Kubernetes target
    k8s_namespace: str = "default"
    demo_app_name: str = "demo-app"

    # Decision thresholds
    rollback_confidence_threshold: int = 75
    human_review_confidence_threshold: int = 40
    error_rate_hard_threshold: float = 0.05

    # Storage
    database_url: str = "sqlite:///./compass.db"

    # Soak window (how long to observe before deciding), in seconds
    soak_window_seconds: int = 120

    # Auto-fix / hotfix PR flow — OFF by default. This is the riskiest
    # part of the system (an AI proposing code changes). Only enable it
    # once you trust the rest of the pipeline. See fix_generator.py.
    enable_auto_fix: bool = False
    github_token: str = ""
    github_repo: str = ""              # e.g. "your-username/compass"
    auto_fix_target_file: str = "infra/demo-app/app/main.py"
    auto_fix_min_confidence: int = 85  # only attempt a fix above this confidence


settings = Settings()
