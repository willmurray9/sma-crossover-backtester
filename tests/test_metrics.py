import pandas as pd

from app.services.metrics import compute_metrics


def test_metrics_with_flat_returns() -> None:
    returns = pd.Series([0.0] * 26)
    metrics = compute_metrics(returns)

    assert metrics["cumulative_return"] == 0.0
    assert metrics["max_drawdown"] == 0.0
    assert metrics["volatility"] == 0.0
    assert metrics["sharpe_ratio"] == 0.0
