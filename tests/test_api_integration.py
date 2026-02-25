from datetime import date, timedelta

import pandas as pd
from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.services.alpaca_data import AlpacaDataError


class _FakeDataServiceSuccess:
    def get_weekly_bars(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        dates = [start + timedelta(days=7 * i) for i in range(30)]
        base = 100.0 if symbol == "SPY" else 120.0 if symbol == "QQQ" else 90.0 if symbol == "DIA" else 110.0
        prices = [base + i for i in range(30)]
        return pd.DataFrame({"date": dates, "close": prices})


class _FakeDataServiceFailure:
    def get_weekly_bars(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        raise AlpacaDataError(f"No weekly bar data returned for symbol '{symbol}'.")


class _FakeDataServiceUpstreamFailure:
    def get_weekly_bars(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        raise AlpacaDataError(f"Alpaca data request failed for {symbol}: 429 rate limited")


def test_backtest_endpoint_success(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/backtest",
        json={"ticker": "AAPL", "start_date": "2020-01-01", "end_date": "2024-01-01", "initial_capital": 10000},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy"]["symbol"] == "AAPL"
    assert len(payload["strategy"]["equity_curve"]) == 30
    assert payload["buy_and_hold"]["symbol"] == "AAPL"
    assert {item["symbol"] for item in payload["benchmarks"]} == {"SPY", "QQQ", "DIA"}


def test_backtest_endpoint_symbol_not_found(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceFailure())
    client = TestClient(app)

    response = client.post(
        "/backtest",
        json={"ticker": "BAD", "start_date": "2020-01-01", "end_date": "2024-01-01", "initial_capital": 10000},
    )

    assert response.status_code == 404
    assert "No weekly bar data" in response.json()["detail"]


def test_backtest_endpoint_upstream_error(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceUpstreamFailure())
    client = TestClient(app)

    response = client.post(
        "/backtest",
        json={"ticker": "AAPL", "start_date": "2020-01-01", "end_date": "2024-01-01", "initial_capital": 10000},
    )

    assert response.status_code == 502
    assert "rate limited" in response.json()["detail"]


def test_backtest_endpoint_applies_horizon_window_and_rebases(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/backtest",
        json={
            "ticker": "AAPL",
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "initial_capital": 10000,
            "horizon": "1M",
        },
    )

    assert response.status_code == 200
    payload = response.json()

    strategy_curve = payload["strategy"]["equity_curve"]
    spy_curve = next(item["equity_curve"] for item in payload["benchmarks"] if item["symbol"] == "SPY")

    assert 0 < len(strategy_curve) < 30
    assert strategy_curve[0]["equity"] == 10000
    assert spy_curve[0]["equity"] == 10000


def test_backtest_endpoint_rejects_invalid_horizon(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/backtest",
        json={
            "ticker": "AAPL",
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "initial_capital": 10000,
            "horizon": "3Y",
        },
    )

    assert response.status_code == 422


def test_portfolio_backtest_endpoint_success(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/portfolio-backtest",
        json={
            "tickers": ["AAPL", "MSFT", "TSLA"],
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "initial_capital": 10000,
            "horizon": "1Y",
            "use_ranking": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy"]["symbol"] == "PORTFOLIO SMA"
    assert payload["buy_and_hold"]["symbol"] == "USER BASKET BUY&HOLD"
    assert payload["benchmark"]["symbol"] == "SPY"
    assert payload["strategy"]["equity_curve"][0]["equity"] == 10000
    assert len(payload["current_holdings"]) == 3


def test_portfolio_backtest_ranking_limits_positions(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/portfolio-backtest",
        json={
            "tickers": ["AAPL", "MSFT", "TSLA"],
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "initial_capital": 10000,
            "horizon": "1Y",
            "use_ranking": True,
            "top_n": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    non_zero_weights = [h for h in payload["current_holdings"] if h["weight"] > 0]
    assert len(non_zero_weights) <= 1


def test_portfolio_backtest_rejects_empty_tickers(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "AlpacaDataService", lambda: _FakeDataServiceSuccess())
    client = TestClient(app)

    response = client.post(
        "/portfolio-backtest",
        json={
            "tickers": [],
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "initial_capital": 10000,
            "horizon": "1Y",
        },
    )

    assert response.status_code == 422
