import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import { TickerInput } from "@/components/TickerInput";
import { PerformanceChart } from "@/components/PerformanceChart";
import { StatsTable } from "@/components/StatsTable";
import { BacktestResponse, fetchBacktest, Horizon } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartPoint {
  date: string;
  strategyValue: number | null;
  spyValue: number | null;
  diaValue: number | null;
  qqqValue: number | null;
}

function buildChartData(result: BacktestResponse): ChartPoint[] {
  const benchmarkBySymbol = new Map(result.benchmarks.map((item) => [item.symbol, item]));
  const spy = new Map(benchmarkBySymbol.get("SPY")?.equity_curve.map((p) => [p.date, p.equity]));
  const dia = new Map(benchmarkBySymbol.get("DIA")?.equity_curve.map((p) => [p.date, p.equity]));
  const qqq = new Map(benchmarkBySymbol.get("QQQ")?.equity_curve.map((p) => [p.date, p.equity]));

  return result.strategy.equity_curve.map((point) => ({
    date: point.date,
    strategyValue: point.equity,
    spyValue: spy.get(point.date) ?? null,
    diaValue: dia.get(point.date) ?? null,
    qqqValue: qqq.get(point.date) ?? null,
  }));
}

const Index = () => {
  const [ticker, setTicker] = useState("AAPL");
  const [horizon, setHorizon] = useState<Horizon>("1Y");

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["backtest", ticker, horizon],
    queryFn: () => fetchBacktest(ticker, horizon),
  });

  const chartData = useMemo(() => (data ? buildChartData(data) : []), [data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm tracking-wide">SMA Crossover Analyzer</span>
          </div>
          <TickerInput onSubmit={setTicker} currentTicker={ticker} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-mono">{ticker}</h1>
          <div className="flex items-center gap-2">
            {(["1M", "6M", "1Y", "5Y", "10Y"] as Horizon[]).map((option) => (
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

        {isPending && (
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full rounded" />
            <Skeleton className="h-[220px] w-full rounded" />
          </div>
        )}

        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && chartData.length > 0 && (
          <>
            <PerformanceChart data={chartData} ticker={ticker} />
            <p className="text-xs text-muted-foreground">
              Chart and statistics reflect the selected horizon and are rebased to a $10,000
              starting value.
            </p>
            <StatsTable
              ticker={ticker}
              strategy={data.strategy.metrics}
              buyAndHold={data.buy_and_hold.metrics}
              benchmarks={data.benchmarks}
            />
          </>
        )}

        {data && chartData.length === 0 && (
          <div className="rounded border border-border bg-card p-6 text-sm text-muted-foreground">
            No data points were returned for this symbol and date range.
          </div>
        )}

        {isFetching && !isPending && (
          <p className="text-xs text-muted-foreground">Refreshing data...</p>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          Historical simulation for educational purposes only. Not financial advice.
        </p>
      </main>
    </div>
  );
};

export default Index;
