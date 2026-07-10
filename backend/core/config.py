from functools import lru_cache
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = Field("development", validation_alias="ENVIRONMENT")

    database_url: str = Field(
        "postgresql://hospital_user:hospital_pass@localhost:5432/hospital_db",
        validation_alias="DATABASE_URL",
    )

    secret_key: str = Field("dev-only-change-me", validation_alias="SECRET_KEY")
    algorithm: str = Field("HS256", validation_alias="ALGORITHM")
    access_token_expire_minutes: int = Field(
        60,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )

    groq_api_key: str = Field("", validation_alias="GROQ_API_KEY")
    use_ollama: bool = Field(False, validation_alias="USE_OLLAMA")
    ollama_base_url: str = Field(
        "http://localhost:11434",
        validation_alias="OLLAMA_BASE_URL",
    )
    ollama_model: str = Field("llama3", validation_alias="OLLAMA_MODEL")

    langsmith_tracing: str = Field("false", validation_alias="LANGSMITH_TRACING")
    langsmith_api_key: str = Field("", validation_alias="LANGSMITH_API_KEY")
    langsmith_project: str = Field(
        "Hospital_Agentic_System",
        validation_alias="LANGSMITH_PROJECT",
    )

    cors_allowed_origins: str = Field(
        "http://localhost:5173,"
        "https://hospital-ms-nandana.vercel.app,"
        "https://agent-care-hms.vercel.app,"
        "https://agent-care-hms-nandana.vercel.app,"
        "https://agentcare-nandana.vercel.app",
        validation_alias="CORS_ALLOWED_ORIGINS",
    )

    @property
    def allowed_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment.lower() == "production":
            if self.secret_key == "dev-only-change-me":
                raise ValueError("SECRET_KEY must be set in production.")
            if not self.groq_api_key and not self.use_ollama:
                raise ValueError("GROQ_API_KEY is required when USE_OLLAMA is false.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
