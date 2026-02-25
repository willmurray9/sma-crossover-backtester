"""Application configuration loaded from environment variables."""

from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    alpaca_api_key: str = os.getenv("ALPACA_API_KEY", "")
    alpaca_api_secret: str = os.getenv("ALPACA_API_SECRET", "")
    alpaca_data_base_url: str = os.getenv("ALPACA_DATA_BASE_URL", "https://data.alpaca.markets")
    alpaca_feed: str = os.getenv("ALPACA_FEED", "iex")
    allowed_origins: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080,https://sma-crossover-backtester.vercel.app",
    )
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))


settings = Settings()
