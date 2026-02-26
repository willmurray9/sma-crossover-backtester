"""Alpaca historical market data access."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import time
from typing import Any

import httpx
import pandas as pd

from app.config import settings


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    close: float


class AlpacaDataError(RuntimeError):
    """Raised when Alpaca data API calls fail."""


class AlpacaDataService:
    _max_attempts = 3
    _retryable_status_codes = {429, 500, 502, 503, 504}

    def __init__(self) -> None:
        if not settings.alpaca_api_key or not settings.alpaca_api_secret:
            raise AlpacaDataError("Missing ALPACA_API_KEY or ALPACA_API_SECRET environment variables.")

        self._base_url = settings.alpaca_data_base_url.rstrip("/")
        self._headers = {
            "APCA-API-KEY-ID": settings.alpaca_api_key,
            "APCA-API-SECRET-KEY": settings.alpaca_api_secret,
        }

    def get_weekly_bars(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        return self._get_bars(symbol=symbol, start=start, end=end, timeframe="1Week", timeframe_label="weekly")

    def get_daily_bars(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        return self._get_bars(symbol=symbol, start=start, end=end, timeframe="1Day", timeframe_label="daily")

    def _get_bars(self, symbol: str, start: date, end: date, timeframe: str, timeframe_label: str) -> pd.DataFrame:
        params: dict[str, Any] = {
            "symbols": symbol.upper(),
            "timeframe": timeframe,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "adjustment": "all",
            "feed": settings.alpaca_feed,
            "limit": 10_000,
            "sort": "asc",
        }

        all_bars: list[Bar] = []
        page_token: str | None = None

        with httpx.Client(timeout=20.0) as client:
            while True:
                request_params = params.copy()
                if page_token:
                    request_params["page_token"] = page_token

                response: httpx.Response | None = None
                for attempt in range(1, self._max_attempts + 1):
                    try:
                        response = client.get(
                            f"{self._base_url}/v2/stocks/bars",
                            params=request_params,
                            headers=self._headers,
                        )
                    except httpx.TimeoutException as exc:
                        if attempt == self._max_attempts:
                            raise AlpacaDataError(
                                f"Alpaca data request timed out for {symbol} after {self._max_attempts} attempts."
                            ) from exc
                        time.sleep(0.5 * attempt)
                        continue

                    if response.status_code in self._retryable_status_codes and attempt < self._max_attempts:
                        time.sleep(0.5 * attempt)
                        continue
                    break

                if response is None:
                    raise AlpacaDataError(f"Unable to complete Alpaca data request for {symbol}.")

                if response.status_code != 200:
                    raise AlpacaDataError(
                        f"Alpaca data request failed for {symbol}: "
                        f"{response.status_code} {response.text}"
                    )

                payload = response.json()
                symbol_bars = payload.get("bars", {}).get(symbol.upper(), [])
                for raw in symbol_bars:
                    all_bars.append(
                        Bar(
                            timestamp=datetime.fromisoformat(raw["t"].replace("Z", "+00:00")),
                            close=float(raw["c"]),
                        )
                    )

                page_token = payload.get("next_page_token")
                if not page_token:
                    break

        if not all_bars:
            raise AlpacaDataError(f"No {timeframe_label} bar data returned for symbol '{symbol.upper()}'.")

        df = pd.DataFrame(
            {
                "date": [bar.timestamp.date() for bar in all_bars],
                "close": [bar.close for bar in all_bars],
            }
        ).drop_duplicates(subset=["date"])

        return df.sort_values("date").reset_index(drop=True)
