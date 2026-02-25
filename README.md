# SMA Backtesting Web App

Monorepo with:
- FastAPI backend for 5-week/20-week SMA crossover backtesting
- React/Vite frontend in `web/`

Benchmarks are ETF proxies: `SPY`, `QQQ`, `DIA`.

## V1 Scope

- User provides ticker + date range
- Strategy: long-only when SMA(5w) > SMA(20w), otherwise cash
- Comparison outputs:
  - Strategy equity curve
  - Ticker buy-and-hold equity curve
  - Benchmark buy-and-hold curves (`SPY`, `QQQ`, `DIA`)
- Summary metrics: cumulative return, CAGR, max drawdown, volatility, Sharpe

## Quick Start

1. Backend setup:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Backend environment:

```bash
cp .env.example .env
# set ALPACA_API_KEY and ALPACA_API_SECRET
```

3. Run backend API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

4. Run frontend (new terminal):

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

5. Open docs:
- Swagger: `http://localhost:8000/docs`

## API

### `GET /health`
Returns service health status.

### `POST /backtest`
Request body:

```json
{
  "ticker": "AAPL",
  "start_date": "2005-01-01",
  "end_date": "2025-12-31",
  "initial_capital": 10000,
  "horizon": "1Y"
}
```

Notes:
- `end_date` is optional. If omitted, backend uses current date.
- `horizon` is optional. Allowed values: `1M`, `6M`, `1Y`, `5Y`, `10Y` (default `1Y`).
- Weekly bars are fetched from Alpaca using `timeframe=1Week`.

## Testing

```bash
.venv/bin/python -m pytest
```

## Frontend Integration Contract

Your frontend should call `POST /backtest` and render:
- `strategy.equity_curve`
- `buy_and_hold.equity_curve`
- each entry in `benchmarks[].equity_curve`
- metrics under each series result
