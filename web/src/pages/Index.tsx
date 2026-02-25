import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, TrendingUp } from "lucide-react";

import { TickerInput } from "@/components/TickerInput";
import { PerformanceChart } from "@/components/PerformanceChart";
import { StatsTable } from "@/components/StatsTable";
import { ModeTabs } from "@/components/ModeTabs";
import { BacktestResponse, fetchBacktest, Horizon } from "@/lib/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartPoint {
  date: string;
  strategyValue: number | null;
  buyAndHoldValue: number | null;
  spyValue: number | null;
  diaValue: number | null;
  qqqValue: number | null;
}

function buildChartData(result: BacktestResponse): ChartPoint[] {
  const benchmarkBySymbol = new Map(result.benchmarks.map((item) => [item.symbol, item]));
  const buyAndHold = new Map(result.buy_and_hold.equity_curve.map((p) => [p.date, p.equity]));
  const spy = new Map(benchmarkBySymbol.get("SPY")?.equity_curve.map((p) => [p.date, p.equity]));
  const dia = new Map(benchmarkBySymbol.get("DIA")?.equity_curve.map((p) => [p.date, p.equity]));
  const qqq = new Map(benchmarkBySymbol.get("QQQ")?.equity_curve.map((p) => [p.date, p.equity]));

  return result.strategy.equity_curve.map((point) => ({
    date: point.date,
    strategyValue: point.equity,
    buyAndHoldValue: buyAndHold.get(point.date) ?? null,
    spyValue: spy.get(point.date) ?? null,
    diaValue: dia.get(point.date) ?? null,
    qqqValue: qqq.get(point.date) ?? null,
  }));
}

const Index = () => {
  const [ticker, setTicker] = useState("AAPL");
  const [horizon, setHorizon] = useState<Horizon>("1Y");
  const [isExplainerOpen, setIsExplainerOpen] = useState(true);

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
          <div className="flex items-center gap-3">
            <ModeTabs />
            <TickerInput onSubmit={setTicker} currentTicker={ticker} />
          </div>
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

        <Collapsible
          open={isExplainerOpen}
          onOpenChange={setIsExplainerOpen}
          className="bg-card border border-border rounded p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              How The SMA Crossover Strategy Works
            </h2>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {isExplainerOpen ? "Hide" : "Show"}
                <ChevronDown className={`h-4 w-4 transition-transform ${isExplainerOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-3 space-y-3 text-sm text-muted-foreground">
            <p>
              This is a trend-following strategy. The idea is simple: stay invested when momentum is
              healthy, and step aside when the trend weakens. A short-term average (5 weeks) is compared
              against a long-term average (20 weeks) to detect those shifts.
            </p>
            <p>
              Trigger rule: if <span className="font-mono text-foreground">SMA(5W) &gt; SMA(20W)</span>, the model
              stays invested; if not, it moves to cash. In practice, that means you can see multiple
              cycles of buy, hold, sell, and re-buy as market direction changes over time.
            </p>
            <div className="rounded border border-border bg-secondary/40 p-3">
              <p className="text-xs uppercase tracking-wide mb-1">Example Signal Timeline (Illustrative)</p>
              <p>
                Week A: <span className="font-mono text-foreground">108 &gt; 102</span> so the next bar is a
                buy/hold signal. Weeks B-C stay invested while 5W remains above 20W. Week D:
                <span className="font-mono text-foreground">97 &lt; 101</span>, so the next bar becomes a sell-to-cash
                signal. Later, if the short average rises again, for example
                <span className="font-mono text-foreground"> 105 &gt; 103</span>, the model re-enters on the next bar.
              </p>
            </div>
            <p>
              People use this style to reduce large drawdowns in prolonged downtrends. The tradeoff is
              that it can react late around turning points and sometimes get whipsawed in choppy markets.
            </p>
          </CollapsibleContent>
        </Collapsible>

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
