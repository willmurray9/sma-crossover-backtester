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

### `POST /portfolio-backtest`
Request body:

```json
{
  "tickers": ["AAPL", "MSFT", "TSLA"],
  "start_date": "2005-01-01",
  "end_date": "2025-12-31",
  "initial_capital": 10000,
  "horizon": "1Y",
  "use_ranking": false,
  "top_n": 3
}
```

Notes:
- Uses weekly SMA(5W)/SMA(20W) signal with one-bar lag per ticker.
- If `use_ranking=true`, holds only top `top_n` active tickers by trailing momentum.
- If no tickers are active, strategy allocation moves to cash.
- Includes `SPY` and an equal-weight user basket buy-and-hold baseline.

## Deployment (Render + Vercel)

### 1) Deploy backend on Render

- Connect this same GitHub repo to Render as a `Web Service`.
- Use:
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Health check path: `/health`
- You can use the included [`render.yaml`](./render.yaml) blueprint.

Set Render environment variables:

- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_DATA_BASE_URL=https://data.alpaca.markets`
- `ALPACA_FEED=iex`
- `ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,https://sma-crossover-backtester.vercel.app`

### 2) Point Vercel frontend to Render backend

- In Vercel project settings, add:
  - `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`
- Redeploy Vercel.

### 3) Verify

- Backend health: `https://<your-render-service>.onrender.com/health`
- Open your Vercel app and confirm network calls go to the Render URL (not `localhost`).

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
