"""Performance metric calculations for weekly return series."""

from __future__ import annotations

import numpy as np
import pandas as pd


WEEKS_PER_YEAR = 52


def compute_metrics(returns: pd.Series) -> dict[str, float]:
    returns = returns.fillna(0.0)

    equity = (1.0 + returns).cumprod()
    total_return = float(equity.iloc[-1] - 1.0)

    periods = len(returns)
    years = max(periods / WEEKS_PER_YEAR, 1 / WEEKS_PER_YEAR)
    cagr = float(equity.iloc[-1] ** (1.0 / years) - 1.0)

    running_max = equity.cummax()
    drawdown = (equity / running_max) - 1.0
    max_drawdown = float(drawdown.min())

    volatility = float(returns.std(ddof=0) * np.sqrt(WEEKS_PER_YEAR))
    mean_annual_return = float(returns.mean() * WEEKS_PER_YEAR)
    sharpe = mean_annual_return / volatility if volatility > 0 else 0.0

    return {
        "cumulative_return": total_return,
        "cagr": cagr,
        "max_drawdown": max_drawdown,
        "volatility": volatility,
        "sharpe_ratio": float(sharpe),
    }
