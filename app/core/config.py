from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://adryan:adryan@localhost:5432/bandarmology"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "super_secret_key_ganti_dengan_random_string_yang_panjang_dan_aman"
    BROKER_API_TOKEN: str = ""
    STOCKBIT_USERNAME: str = ""
    STOCKBIT_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
