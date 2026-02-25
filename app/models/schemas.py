"""Pydantic models used by the API layer."""

from datetime import date
from typing import Literal
from pydantic import BaseModel, Field

Horizon = Literal["1M", "6M", "1Y", "5Y", "10Y"]


class BacktestRequest(BaseModel):
    ticker: str = Field(..., description="US equity ticker, e.g. AAPL")
    start_date: date = Field(default=date(2005, 1, 1))
    end_date: date | None = Field(default=None)
    initial_capital: float = Field(default=10_000.0, gt=0)
    horizon: Horizon = Field(default="1Y")


class EquityPoint(BaseModel):
    date: date
    equity: float


class MetricSummary(BaseModel):
    cumulative_return: float
    cagr: float
    max_drawdown: float
    volatility: float
    sharpe_ratio: float


class SeriesResult(BaseModel):
    symbol: str
    equity_curve: list[EquityPoint]
    metrics: MetricSummary


class BacktestResponse(BaseModel):
    strategy: SeriesResult
    buy_and_hold: SeriesResult
    benchmarks: list[SeriesResult]
