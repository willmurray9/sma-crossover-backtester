"""SMA crossover strategy calculations."""

from __future__ import annotations

import pandas as pd


def run_sma_crossover(
    df: pd.DataFrame,
    initial_capital: float,
    position_mode: str = "long_only",
) -> pd.DataFrame:
    """Run 5-week / 20-week SMA crossover as long-or-cash strategy.

    Uses a one-bar lag on signal to avoid lookahead bias.
    """
    data = df.copy()
    data["ret"] = data["close"].pct_change().fillna(0.0)
    data["sma_5"] = data["close"].rolling(window=5, min_periods=5).mean()
    data["sma_20"] = data["close"].rolling(window=20, min_periods=20).mean()
    ma_ready = data["sma_5"].notna() & data["sma_20"].notna()

    if position_mode == "long_short":
        data["signal"] = 0.0
        data.loc[ma_ready & (data["sma_5"] > data["sma_20"]), "signal"] = 1.0
        data.loc[ma_ready & (data["sma_5"] <= data["sma_20"]), "signal"] = -1.0
    else:
        data["signal"] = 0.0
        data.loc[ma_ready & (data["sma_5"] > data["sma_20"]), "signal"] = 1.0

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


def run_mean_reversion_zscore(
    df: pd.DataFrame,
    initial_capital: float,
    lookback: int = 20,
    entry_z: float = 2.0,
    exit_z: float = 0.5,
    stop_loss_pct: float | None = None,
    max_holding_bars: int | None = None,
    allow_short: bool = True,
) -> pd.DataFrame:
    """Run long/short mean reversion using rolling z-score and one-bar execution lag."""
    data = df.copy()
    data["ret"] = data["close"].pct_change().fillna(0.0)
    data["mean"] = data["close"].rolling(window=lookback, min_periods=lookback).mean()
    data["std"] = data["close"].rolling(window=lookback, min_periods=lookback).std()
    data["std"] = data["std"].where(data["std"] != 0.0)
    data["zscore"] = (data["close"] - data["mean"]) / data["std"]

    signal: list[float] = []
    active_position = 0.0
    entry_price: float | None = None
    bars_held = 0

    for row in data.itertuples(index=False):
        zscore = row.zscore
        close = float(row.close)
        zscore_ready = pd.notna(zscore)

        if active_position == 0.0:
            if zscore_ready and float(zscore) <= -entry_z:
                active_position = 1.0
                entry_price = close
                bars_held = 0
            elif zscore_ready and allow_short and float(zscore) >= entry_z:
                active_position = -1.0
                entry_price = close
                bars_held = 0
            signal.append(active_position)
            continue

        bars_held += 1
        exit_signal = False
        if active_position > 0 and zscore_ready and float(zscore) >= -exit_z:
            exit_signal = True
        if active_position < 0 and zscore_ready and float(zscore) <= exit_z:
            exit_signal = True

        stop_hit = False
        if stop_loss_pct is not None and entry_price is not None and entry_price > 0:
            if active_position > 0:
                current_pnl = (close / entry_price) - 1.0
            else:
                current_pnl = (entry_price / close) - 1.0
            stop_hit = current_pnl <= -stop_loss_pct

        timed_exit = max_holding_bars is not None and bars_held >= max_holding_bars
        if exit_signal or stop_hit or timed_exit:
            active_position = 0.0
            entry_price = None
            bars_held = 0

        signal.append(active_position)

    data["signal"] = signal
    data["position"] = data["signal"].shift(1).fillna(0.0)
    data["strategy_ret"] = data["position"] * data["ret"]
    data["strategy_equity"] = initial_capital * (1.0 + data["strategy_ret"]).cumprod()
    data["buy_hold_equity"] = initial_capital * (1.0 + data["ret"]).cumprod()

    return data
