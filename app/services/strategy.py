"""SMA crossover strategy calculations."""

from __future__ import annotations

import pandas as pd


def run_sma_crossover(df: pd.DataFrame, initial_capital: float) -> pd.DataFrame:
    """Run 5-week / 20-week SMA crossover as long-or-cash strategy.

    Uses a one-bar lag on signal to avoid lookahead bias.
    """
    data = df.copy()
    data["ret"] = data["close"].pct_change().fillna(0.0)
    data["sma_5"] = data["close"].rolling(window=5, min_periods=5).mean()
    data["sma_20"] = data["close"].rolling(window=20, min_periods=20).mean()
    data["signal"] = (data["sma_5"] > data["sma_20"]).astype(float)
    data["position"] = data["signal"].shift(1).fillna(0.0)
    data["strategy_ret"] = data["position"] * data["ret"]

    data["strategy_equity"] = initial_capital * (1.0 + data["strategy_ret"]).cumprod()
    data["buy_hold_equity"] = initial_capital * (1.0 + data["ret"]).cumprod()

    return data


def buy_and_hold(df: pd.DataFrame, initial_capital: float) -> pd.DataFrame:
    """Compute buy-and-hold equity curve for a price series."""
    data = df.copy()
    data["ret"] = data["close"].pct_change().fillna(0.0)
    data["equity"] = initial_capital * (1.0 + data["ret"]).cumprod()
    return data
