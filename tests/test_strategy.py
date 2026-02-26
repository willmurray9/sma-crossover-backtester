from datetime import date, timedelta

import pandas as pd

from app.services.strategy import run_sma_crossover


def test_sma_strategy_produces_required_columns() -> None:
    prices = [100 + i for i in range(30)]
    start = date(2020, 1, 3)
    df = pd.DataFrame(
        {
            "date": [start + timedelta(days=7 * i) for i in range(len(prices))],
            "close": prices,
        }
    )

    result = run_sma_crossover(df, initial_capital=10_000)

    for column in ["sma_5", "sma_20", "position", "strategy_ret", "strategy_equity", "buy_hold_equity"]:
        assert column in result.columns

    assert result["strategy_equity"].iloc[0] == 10_000
    assert result["buy_hold_equity"].iloc[0] == 10_000


def test_long_short_mode_takes_inverse_crossovers() -> None:
    prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128,
              126, 124, 122, 120, 118, 116, 114, 112, 110, 108, 106, 104, 102, 100, 98]
    start = date(2020, 1, 3)
    df = pd.DataFrame(
        {
            "date": [start + timedelta(days=7 * i) for i in range(len(prices))],
            "close": prices,
        }
    )

    long_only = run_sma_crossover(df, initial_capital=10_000, position_mode="long_only")
    long_short = run_sma_crossover(df, initial_capital=10_000, position_mode="long_short")

    assert (long_only["position"] < 0).sum() == 0
    assert (long_short["position"] < 0).sum() > 0
