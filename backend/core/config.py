from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Stock Analysis"
    
    # FMP Config
    FMP_API_KEY: str = ""
    FMP_BASE_URL: str = "https://financialmodelingprep.com/stable"
    
    # Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "stock_analyzer"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Auth (Testing)
    TEAM_PASSWORD: str = "supersecret" # Very simple auth for testing

    # Telegram Settings
    TG_BOT_TOKEN: str = ""
    TG_CHAT_ID: str = ""
    TG_SIGNAL_BOT_TOKEN: str = ""

    # Let's Encrypt / Admin
    ADMIN_EMAIL: str = "gea54845@mail.ru"

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
