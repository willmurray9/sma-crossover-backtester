"""FastAPI entrypoint for SMA crossover backtesting."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import (
    BacktestRequest,
    BacktestResponse,
    EquityPoint,
    MetricSummary,
    SeriesResult,
)
from app.services.alpaca_data import AlpacaDataError, AlpacaDataService
from app.services.metrics import compute_metrics
from app.services.strategy import buy_and_hold, run_sma_crossover


app = FastAPI(title="SMA Backtesting API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/backtest", response_model=BacktestResponse)
def backtest(payload: BacktestRequest) -> BacktestResponse:
    end_date = payload.end_date or date.today()
    if payload.start_date >= end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    try:
        data_service = AlpacaDataService()
        ticker_df = data_service.get_weekly_bars(payload.ticker, payload.start_date, end_date)
        strategy_df = run_sma_crossover(ticker_df, payload.initial_capital)

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
            benchmark_df = data_service.get_weekly_bars(benchmark, payload.start_date, end_date)
            benchmark_curve_df = buy_and_hold(benchmark_df, payload.initial_capital)
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
        status_code = 404 if "No weekly bar data returned for symbol" in message else 502
        raise HTTPException(status_code=status_code, detail=message) from exc

    return BacktestResponse(
        strategy=strategy_result,
        buy_and_hold=buy_hold_result,
        benchmarks=benchmarks,
    )
