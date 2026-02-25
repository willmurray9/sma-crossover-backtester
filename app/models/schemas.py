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


class PortfolioBacktestRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1, description="User-selected tickers, e.g. ['AAPL', 'MSFT']")
    start_date: date = Field(default=date(2005, 1, 1))
    end_date: date | None = Field(default=None)
    initial_capital: float = Field(default=10_000.0, gt=0)
    horizon: Horizon = Field(default="1Y")
    use_ranking: bool = Field(default=False)
    top_n: int = Field(default=3, ge=1, le=25)


class PortfolioHolding(BaseModel):
    symbol: str
    weight: float
    in_market: bool


class PortfolioBacktestResponse(BaseModel):
    strategy: SeriesResult
    buy_and_hold: SeriesResult
    benchmark: SeriesResult
    current_holdings: list[PortfolioHolding]
