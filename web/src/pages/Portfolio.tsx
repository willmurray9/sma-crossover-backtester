import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import { ModeTabs } from "@/components/ModeTabs";
import { PortfolioPerformanceChart } from "@/components/PortfolioPerformanceChart";
import { PortfolioStatsTable } from "@/components/PortfolioStatsTable";
import { Horizon, PortfolioBacktestResponse, fetchPortfolioBacktest } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioChartPoint {
  date: string;
  strategyValue: number | null;
  buyHoldValue: number | null;
  spyValue: number | null;
}

interface PortfolioRequestState {
  tickers: string[];
  horizon: Horizon;
  useRanking: boolean;
  topN: number;
}

const HORIZON_OPTIONS: Horizon[] = ["1M", "6M", "1Y", "5Y", "10Y"];

function parseTickers(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(",")) {
    const symbol = part.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    result.push(symbol);
  }
  return result;
}

function buildChartData(result: PortfolioBacktestResponse): PortfolioChartPoint[] {
  const buyHoldByDate = new Map(result.buy_and_hold.equity_curve.map((p) => [p.date, p.equity]));
  const spyByDate = new Map(result.benchmark.equity_curve.map((p) => [p.date, p.equity]));

  return result.strategy.equity_curve.map((point) => ({
    date: point.date,
    strategyValue: point.equity,
    buyHoldValue: buyHoldByDate.get(point.date) ?? null,
    spyValue: spyByDate.get(point.date) ?? null,
  }));
}

const Portfolio = () => {
  const [tickersInput, setTickersInput] = useState("AAPL, MSFT, TSLA");
  const [horizon, setHorizon] = useState<Horizon>("1Y");
  const [useRanking, setUseRanking] = useState(false);
  const [topN, setTopN] = useState(3);
  const [inputError, setInputError] = useState<string | null>(null);

  const [requestState, setRequestState] = useState<PortfolioRequestState>({
    tickers: ["AAPL", "MSFT", "TSLA"],
    horizon: "1Y",
    useRanking: false,
    topN: 3,
  });

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["portfolio-backtest", requestState],
    queryFn: () =>
      fetchPortfolioBacktest(
        requestState.tickers,
        requestState.horizon,
        requestState.useRanking,
        requestState.topN
      ),
  });

  const chartData = useMemo(() => (data ? buildChartData(data) : []), [data]);

  const handleRunBacktest = () => {
    const parsedTickers = parseTickers(tickersInput);
    if (parsedTickers.length === 0) {
      setInputError("Add at least one ticker (example: AAPL, MSFT, TSLA).");
      return;
    }
    setInputError(null);
    setRequestState({
      tickers: parsedTickers,
      horizon,
      useRanking,
      topN,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm tracking-wide">SMA Crossover Analyzer</span>
          </div>
          <ModeTabs />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <div className="rounded border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">Portfolio Backtest</h1>
            <div className="flex items-center gap-2">
              {HORIZON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setHorizon(option)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                    horizon === option
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7">
              <label className="text-xs text-muted-foreground block mb-1">Tickers (comma-separated)</label>
              <input
                type="text"
                value={tickersInput}
                onChange={(event) => setTickersInput(event.target.value)}
                className="w-full h-10 rounded border border-border bg-background px-3 font-mono text-sm"
                placeholder="AAPL, MSFT, TSLA"
              />
            </div>
            <div className="lg:col-span-3 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-foreground h-10">
                <input
                  type="checkbox"
                  checked={useRanking}
                  onChange={(event) => setUseRanking(event.target.checked)}
                />
                Use ranking (top N momentum)
              </label>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Top N</label>
              <input
                type="number"
                min={1}
                max={25}
                value={topN}
                onChange={(event) => setTopN(Number(event.target.value) || 1)}
                disabled={!useRanking}
                className="w-full h-10 rounded border border-border bg-background px-3 font-mono text-sm disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Rebalances weekly with SMA(5W)/SMA(20W), one-bar signal lag, and cash when no names are in trend.
            </p>
            <button
              type="button"
              onClick={handleRunBacktest}
              className="h-9 px-4 rounded bg-primary text-primary-foreground text-sm font-medium"
            >
              Run Portfolio Backtest
            </button>
          </div>

          {inputError && <p className="text-sm text-destructive">{inputError}</p>}
        </div>

        {isPending && (
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full rounded" />
            <Skeleton className="h-[260px] w-full rounded" />
          </div>
        )}

        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && chartData.length > 0 && (
          <>
            <PortfolioPerformanceChart data={chartData} />
            <p className="text-xs text-muted-foreground">
              Series are rebased to a $10,000 starting value for the selected horizon.
            </p>
            <PortfolioStatsTable
              strategy={data.strategy.metrics}
              buyAndHold={data.buy_and_hold.metrics}
              spy={data.benchmark.metrics}
              holdings={data.current_holdings}
            />
          </>
        )}

        {data && chartData.length === 0 && (
          <div className="rounded border border-border bg-card p-6 text-sm text-muted-foreground">
            No data points were returned for the selected portfolio and horizon.
          </div>
        )}

        {isFetching && !isPending && (
          <p className="text-xs text-muted-foreground">Refreshing portfolio data...</p>
        )}
      </main>
    </div>
  );
};

export default Portfolio;
