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
