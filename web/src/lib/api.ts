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

export interface PortfolioHolding {
  symbol: string;
  weight: number;
  in_market: boolean;
}

export interface PortfolioBacktestResponse {
  strategy: SeriesResult;
  buy_and_hold: SeriesResult;
  benchmark: SeriesResult;
  current_holdings: PortfolioHolding[];
}

export type Horizon = "1M" | "6M" | "1Y" | "5Y" | "10Y";
export type MATimeframe = "weekly" | "daily";
export type PositionMode = "long_only" | "long_short";
export type StrategyType = "sma_crossover" | "mean_reversion_zscore";

interface BacktestRequest {
  ticker: string;
  start_date: string;
  end_date?: string;
  initial_capital: number;
  horizon: Horizon;
  ma_timeframe: MATimeframe;
  position_mode: PositionMode;
  strategy_type: StrategyType;
  mr_lookback: number;
  mr_entry_z: number;
  mr_exit_z: number;
  mr_stop_loss_pct?: number;
  mr_max_holding_bars?: number;
  mr_allow_short: boolean;
}

export interface MeanReversionParams {
  lookback: number;
  entryZ: number;
  exitZ: number;
  stopLossPct?: number;
  maxHoldingBars?: number;
  allowShort: boolean;
}

interface PortfolioBacktestRequest {
  tickers: string[];
  start_date: string;
  end_date?: string;
  initial_capital: number;
  horizon: Horizon;
  use_ranking: boolean;
  top_n: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchBacktest(
  ticker: string,
  horizon: Horizon,
  maTimeframe: MATimeframe,
  positionMode: PositionMode,
  strategyType: StrategyType,
  meanReversion: MeanReversionParams
): Promise<BacktestResponse> {
  const body: BacktestRequest = {
    ticker,
    start_date: "2005-01-01",
    initial_capital: 10000,
    horizon,
    ma_timeframe: maTimeframe,
    position_mode: positionMode,
    strategy_type: strategyType,
    mr_lookback: meanReversion.lookback,
    mr_entry_z: meanReversion.entryZ,
    mr_exit_z: meanReversion.exitZ,
    mr_stop_loss_pct: meanReversion.stopLossPct,
    mr_max_holding_bars: meanReversion.maxHoldingBars,
    mr_allow_short: meanReversion.allowShort,
  };

  const response = await fetch(`${API_BASE_URL}/backtest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseResponse<BacktestResponse>(response);
}

export async function fetchPortfolioBacktest(
  tickers: string[],
  horizon: Horizon,
  useRanking: boolean,
  topN: number
): Promise<PortfolioBacktestResponse> {
  const body: PortfolioBacktestRequest = {
    tickers,
    start_date: "2005-01-01",
    initial_capital: 10000,
    horizon,
    use_ranking: useRanking,
    top_n: topN,
  };

  const response = await fetch(`${API_BASE_URL}/portfolio-backtest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseResponse<PortfolioBacktestResponse>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
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

  return (await response.json()) as T;
}
