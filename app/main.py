"""FastAPI entrypoint for SMA crossover backtesting."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pandas as pd

from app.config import settings
from app.models.schemas import (
    BacktestRequest,
    BacktestResponse,
    EquityPoint,
    MetricSummary,
    PortfolioBacktestRequest,
    PortfolioBacktestResponse,
    PortfolioHolding,
    SeriesResult,
)
from app.services.alpaca_data import AlpacaDataError, AlpacaDataService
from app.services.metrics import compute_metrics
from app.services.strategy import buy_and_hold, run_sma_crossover

_HORIZON_MONTHS = {"1M": 1, "6M": 6, "1Y": 12, "5Y": 60, "10Y": 120}
_DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"]


app = FastAPI(title="SMA Backtesting API", version="0.1.0")


def _parse_allowed_origins(raw_origins: str) -> list[str]:
    values = [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]
    if not values:
        values = _DEFAULT_ALLOWED_ORIGINS.copy()
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        if value in seen:
            continue
        normalized.append(value)
        seen.add(value)
    return normalized


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def _apply_horizon_window_and_rebase(
    df: pd.DataFrame,
    horizon: str,
    initial_capital: float,
    return_columns: list[str],
    equity_columns: list[str],
) -> pd.DataFrame:
    if df.empty:
        return df

    latest_date = pd.Timestamp(df["date"].iloc[-1])
    cutoff = (latest_date - pd.DateOffset(months=_HORIZON_MONTHS[horizon])).date()
    window_df = df[df["date"] >= cutoff].copy()
    if window_df.empty:
        window_df = df.copy()

    window_df = window_df.reset_index(drop=True)

    for column in return_columns:
        if column in window_df.columns:
            window_df.loc[0, column] = 0.0

    for column in equity_columns:
        if column not in window_df.columns:
            continue
        base_equity = float(window_df.loc[0, column])
        if base_equity <= 0:
            window_df[column] = initial_capital
            continue
        window_df[column] = initial_capital * (window_df[column] / base_equity)

    return window_df


def _normalize_tickers(raw_tickers: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for ticker in raw_tickers:
        symbol = ticker.strip().upper()
        if not symbol or symbol in seen:
            continue
        cleaned.append(symbol)
        seen.add(symbol)
    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one valid ticker is required.")
    return cleaned


def _get_price_bars(
    data_service: AlpacaDataService,
    ticker: str,
    start_date: date,
    end_date: date,
    ma_timeframe: str,
) -> pd.DataFrame:
    if ma_timeframe == "daily":
        return data_service.get_daily_bars(ticker, start_date, end_date)
    return data_service.get_weekly_bars(ticker, start_date, end_date)


@app.post("/backtest", response_model=BacktestResponse)
def backtest(payload: BacktestRequest) -> BacktestResponse:
    end_date = payload.end_date or date.today()
    if payload.start_date >= end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    try:
        data_service = AlpacaDataService()
        ticker_df = _get_price_bars(
            data_service,
            payload.ticker,
            payload.start_date,
            end_date,
            payload.ma_timeframe,
        )
        strategy_df_full = run_sma_crossover(
            ticker_df,
            payload.initial_capital,
            position_mode=payload.position_mode,
        )
        strategy_df = _apply_horizon_window_and_rebase(
            strategy_df_full,
            payload.horizon,
            payload.initial_capital,
            return_columns=["ret", "strategy_ret"],
            equity_columns=["strategy_equity", "buy_hold_equity"],
        )

        strategy_metrics = compute_metrics(strategy_df["strategy_ret"])
        buy_hold_metrics = compute_metrics(strategy_df["ret"])

        strategy_result = SeriesResult(
            symbol=payload.ticker.upper(),
            equity_curve=[
                EquityPoint(date=row.date, equity=float(row.strategy_equity))
                for row in strategy_df.itertuples(index=False)
            ],
            metrics=MetricSummary(**strategy_metrics),
        )

        buy_hold_result = SeriesResult(
            symbol=payload.ticker.upper(),
            equity_curve=[
                EquityPoint(date=row.date, equity=float(row.buy_hold_equity))
                for row in strategy_df.itertuples(index=False)
            ],
            metrics=MetricSummary(**buy_hold_metrics),
        )

        benchmarks: list[SeriesResult] = []
        for benchmark in ("SPY", "QQQ", "DIA"):
            benchmark_df = _get_price_bars(
                data_service,
                benchmark,
                payload.start_date,
                end_date,
                payload.ma_timeframe,
            )
            benchmark_curve_df_full = buy_and_hold(benchmark_df, payload.initial_capital)
            benchmark_curve_df = _apply_horizon_window_and_rebase(
                benchmark_curve_df_full,
                payload.horizon,
                payload.initial_capital,
                return_columns=["ret"],
                equity_columns=["equity"],
            )
            benchmark_metrics = compute_metrics(benchmark_curve_df["ret"])
            benchmarks.append(
                SeriesResult(
                    symbol=benchmark,
                    equity_curve=[
                        EquityPoint(date=row.date, equity=float(row.equity))
                        for row in benchmark_curve_df.itertuples(index=False)
                    ],
                    metrics=MetricSummary(**benchmark_metrics),
                )
            )

    except AlpacaDataError as exc:
        message = str(exc)
        status_code = 404 if "bar data returned for symbol" in message else 502
        raise HTTPException(status_code=status_code, detail=message) from exc

    return BacktestResponse(
        strategy=strategy_result,
        buy_and_hold=buy_hold_result,
        benchmarks=benchmarks,
    )


@app.post("/portfolio-backtest", response_model=PortfolioBacktestResponse)
def portfolio_backtest(payload: PortfolioBacktestRequest) -> PortfolioBacktestResponse:
    end_date = payload.end_date or date.today()
    if payload.start_date >= end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    tickers = _normalize_tickers(payload.tickers)

    try:
        data_service = AlpacaDataService()

        strategy_inputs: dict[str, pd.DataFrame] = {}
        for ticker in tickers:
            ticker_df = data_service.get_weekly_bars(ticker, payload.start_date, end_date)
            strategy_inputs[ticker] = run_sma_crossover(ticker_df, initial_capital=1.0)[
                ["date", "ret", "position"]
            ]

        all_dates = sorted({d for df in strategy_inputs.values() for d in df["date"].tolist()})
        if not all_dates:
            raise AlpacaDataError("No weekly bar data returned for selected tickers.")

        returns_wide = pd.DataFrame(index=all_dates)
        positions_wide = pd.DataFrame(index=all_dates)
        for ticker in tickers:
            ticker_df = strategy_inputs[ticker].set_index("date")
            returns_wide[ticker] = ticker_df["ret"]
            positions_wide[ticker] = ticker_df["position"]

        returns_wide = returns_wide.sort_index().fillna(0.0)
        positions_wide = positions_wide.sort_index().fillna(0.0)
        momentum_wide = (1.0 + returns_wide).rolling(window=26, min_periods=4).apply(np.prod, raw=True) - 1.0

        top_n = min(payload.top_n, len(tickers))
        portfolio_rets: list[float] = []
        latest_weights: dict[str, float] = {ticker: 0.0 for ticker in tickers}
        latest_in_market: dict[str, bool] = {ticker: False for ticker in tickers}

        for current_date in returns_wide.index:
            active = [ticker for ticker in tickers if float(positions_wide.at[current_date, ticker]) > 0]
            selected = active
            if payload.use_ranking and active:
                ranked = sorted(
                    active,
                    key=lambda ticker: float(momentum_wide.at[current_date, ticker])
                    if pd.notna(momentum_wide.at[current_date, ticker])
                    else float("-inf"),
                    reverse=True,
                )
                selected = ranked[:top_n]

            weights = {ticker: 0.0 for ticker in tickers}
            if selected:
                weight = 1.0 / len(selected)
                for ticker in selected:
                    weights[ticker] = weight

            portfolio_rets.append(
                float(sum(weights[ticker] * float(returns_wide.at[current_date, ticker]) for ticker in tickers))
            )
            latest_weights = weights
            latest_in_market = {ticker: ticker in active for ticker in tickers}

        portfolio_df_full = pd.DataFrame(
            {
                "date": returns_wide.index.to_list(),
                "strategy_ret": portfolio_rets,
                "basket_ret": returns_wide.mean(axis=1).astype(float).tolist(),
            }
        )
        portfolio_df_full["strategy_equity"] = payload.initial_capital * (1.0 + portfolio_df_full["strategy_ret"]).cumprod()
        portfolio_df_full["buy_hold_equity"] = payload.initial_capital * (1.0 + portfolio_df_full["basket_ret"]).cumprod()

        portfolio_df = _apply_horizon_window_and_rebase(
            portfolio_df_full,
            payload.horizon,
            payload.initial_capital,
            return_columns=["strategy_ret", "basket_ret"],
            equity_columns=["strategy_equity", "buy_hold_equity"],
        )

        strategy_metrics = compute_metrics(portfolio_df["strategy_ret"])
        basket_metrics = compute_metrics(portfolio_df["basket_ret"])

        spy_df = data_service.get_weekly_bars("SPY", payload.start_date, end_date)
        spy_curve_df_full = buy_and_hold(spy_df, payload.initial_capital)
        spy_curve_df = _apply_horizon_window_and_rebase(
            spy_curve_df_full,
            payload.horizon,
            payload.initial_capital,
            return_columns=["ret"],
            equity_columns=["equity"],
        )
        spy_metrics = compute_metrics(spy_curve_df["ret"])

    except AlpacaDataError as exc:
        message = str(exc)
        status_code = 404 if "No weekly bar data returned for symbol" in message else 502
        raise HTTPException(status_code=status_code, detail=message) from exc

    strategy_result = SeriesResult(
        symbol="PORTFOLIO SMA",
        equity_curve=[
            EquityPoint(date=row.date, equity=float(row.strategy_equity)) for row in portfolio_df.itertuples(index=False)
        ],
        metrics=MetricSummary(**strategy_metrics),
    )

    buy_hold_result = SeriesResult(
        symbol="USER BASKET BUY&HOLD",
        equity_curve=[EquityPoint(date=row.date, equity=float(row.buy_hold_equity)) for row in portfolio_df.itertuples(index=False)],
        metrics=MetricSummary(**basket_metrics),
    )

    benchmark_result = SeriesResult(
        symbol="SPY",
        equity_curve=[EquityPoint(date=row.date, equity=float(row.equity)) for row in spy_curve_df.itertuples(index=False)],
        metrics=MetricSummary(**spy_metrics),
    )

    current_holdings = [
        PortfolioHolding(
            symbol=ticker,
            weight=float(latest_weights[ticker]),
            in_market=bool(latest_in_market[ticker]),
        )
        for ticker in tickers
    ]

    return PortfolioBacktestResponse(
        strategy=strategy_result,
        buy_and_hold=buy_hold_result,
        benchmark=benchmark_result,
        current_holdings=current_holdings,
    )
