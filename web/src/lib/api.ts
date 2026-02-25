export interface EquityPoint {
  date: string;
  equity: number;
}

export interface MetricSummary {
  cumulative_return: number;
  cagr: number;
  max_drawdown: number;
  volatility: number;
  sharpe_ratio: number;
}

export interface SeriesResult {
  symbol: string;
  equity_curve: EquityPoint[];
  metrics: MetricSummary;
}

export interface BacktestResponse {
  strategy: SeriesResult;
  buy_and_hold: SeriesResult;
  benchmarks: SeriesResult[];
}

interface BacktestRequest {
  ticker: string;
  start_date: string;
  end_date?: string;
  initial_capital: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchBacktest(ticker: string): Promise<BacktestResponse> {
  const body: BacktestRequest = {
    ticker,
    start_date: "2005-01-01",
    initial_capital: 10000,
  };

  const response = await fetch(`${API_BASE_URL}/backtest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const error = await response.json();
      detail = error.detail ?? detail;
    } catch {
      // fall back to default message
    }
    throw new Error(detail);
  }

  return (await response.json()) as BacktestResponse;
}
