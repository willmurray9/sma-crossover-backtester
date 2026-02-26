import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, TrendingUp } from "lucide-react";

import { TickerInput } from "@/components/TickerInput";
import { PerformanceChart } from "@/components/PerformanceChart";
import { StatsTable } from "@/components/StatsTable";
import { ModeTabs } from "@/components/ModeTabs";
import {
  BacktestResponse,
  fetchBacktest,
  Horizon,
  MATimeframe,
  MeanReversionParams,
  PositionMode,
  StrategyType,
} from "@/lib/api";
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
  const [strategyType, setStrategyType] = useState<StrategyType>("sma_crossover");
  const [maTimeframe, setMaTimeframe] = useState<MATimeframe>("weekly");
  const [positionMode, setPositionMode] = useState<PositionMode>("long_only");
  const [mrLookback, setMrLookback] = useState("20");
  const [mrEntryZ, setMrEntryZ] = useState("2.0");
  const [mrExitZ, setMrExitZ] = useState("0.5");
  const [mrStopLossPct, setMrStopLossPct] = useState("");
  const [mrMaxHoldingBars, setMrMaxHoldingBars] = useState("");
  const [mrAllowShort, setMrAllowShort] = useState(true);
  const [isExplainerOpen, setIsExplainerOpen] = useState(true);

  const meanReversionParams: MeanReversionParams = useMemo(
    () => ({
      lookback: Number.isFinite(Number(mrLookback)) && Number(mrLookback) >= 5 ? Number(mrLookback) : 20,
      entryZ: Number.isFinite(Number(mrEntryZ)) && Number(mrEntryZ) > 0 ? Number(mrEntryZ) : 2.0,
      exitZ: Number.isFinite(Number(mrExitZ)) && Number(mrExitZ) >= 0 ? Number(mrExitZ) : 0.5,
      stopLossPct:
        Number.isFinite(Number(mrStopLossPct)) && Number(mrStopLossPct) > 0 ? Number(mrStopLossPct) : undefined,
      maxHoldingBars:
        Number.isFinite(Number(mrMaxHoldingBars)) && Number(mrMaxHoldingBars) >= 1
          ? Number(mrMaxHoldingBars)
          : undefined,
      allowShort: mrAllowShort,
    }),
    [mrLookback, mrEntryZ, mrExitZ, mrStopLossPct, mrMaxHoldingBars, mrAllowShort]
  );

  const strategyLabel = strategyType === "sma_crossover" ? "SMA Strategy" : "Mean Reversion Strategy";

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["backtest", ticker, horizon, strategyType, maTimeframe, positionMode, meanReversionParams],
    queryFn: () => fetchBacktest(ticker, horizon, maTimeframe, positionMode, strategyType, meanReversionParams),
  });

  const chartData = useMemo(() => (data ? buildChartData(data) : []), [data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm tracking-wide">Technical Strategy Analyzer</span>
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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strategy</span>
              <button
                type="button"
                onClick={() => setStrategyType("sma_crossover")}
                className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                  strategyType === "sma_crossover"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                SMA Crossover
              </button>
              <button
                type="button"
                onClick={() => setStrategyType("mean_reversion_zscore")}
                className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                  strategyType === "mean_reversion_zscore"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Mean Reversion
              </button>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signal</span>
              <button
                type="button"
                onClick={() => setMaTimeframe("weekly")}
                className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                  maTimeframe === "weekly"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {strategyType === "sma_crossover" ? "Weekly 5/20" : "Weekly Bars"}
              </button>
              <button
                type="button"
                onClick={() => setMaTimeframe("daily")}
                className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                  maTimeframe === "daily"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {strategyType === "sma_crossover" ? "Daily 5/20" : "Daily Bars"}
              </button>
            </div>
            {strategyType === "sma_crossover" && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</span>
                <button
                  type="button"
                  onClick={() => setPositionMode("long_only")}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                    positionMode === "long_only"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Long Only
                </button>
                <button
                  type="button"
                  onClick={() => setPositionMode("long_short")}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                    positionMode === "long_short"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Long + Short
                </button>
              </div>
            )}
            {strategyType === "mean_reversion_zscore" && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shorting</span>
                <button
                  type="button"
                  onClick={() => setMrAllowShort(true)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                    mrAllowShort
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  onClick={() => setMrAllowShort(false)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono transition-colors ${
                    !mrAllowShort
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Disabled
                </button>
              </div>
            )}
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

        {strategyType === "mean_reversion_zscore" && (
          <div className="bg-card border border-border rounded p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Mean Reversion Parameters
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="text-xs text-muted-foreground">
                Lookback
                <input
                  type="number"
                  min={5}
                  max={252}
                  step={1}
                  value={mrLookback}
                  onChange={(e) => setMrLookback(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-secondary px-2 py-1.5 font-mono text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Entry Z
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={mrEntryZ}
                  onChange={(e) => setMrEntryZ(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-secondary px-2 py-1.5 font-mono text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Exit Z
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={mrExitZ}
                  onChange={(e) => setMrExitZ(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-secondary px-2 py-1.5 font-mono text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Stop Loss (0-1)
                <input
                  type="number"
                  min={0}
                  max={0.99}
                  step={0.01}
                  placeholder="off"
                  value={mrStopLossPct}
                  onChange={(e) => setMrStopLossPct(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-secondary px-2 py-1.5 font-mono text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Max Hold Bars
                <input
                  type="number"
                  min={1}
                  max={252}
                  step={1}
                  placeholder="off"
                  value={mrMaxHoldingBars}
                  onChange={(e) => setMrMaxHoldingBars(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-secondary px-2 py-1.5 font-mono text-sm text-foreground"
                />
              </label>
            </div>
          </div>
        )}

        <Collapsible
          open={isExplainerOpen}
          onOpenChange={setIsExplainerOpen}
          className="bg-card border border-border rounded p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {strategyType === "sma_crossover"
                ? "How The SMA Crossover Strategy Works"
                : "How The Mean Reversion Strategy Works"}
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
            {strategyType === "sma_crossover" ? (
              <>
                <p>
                  This is a trend-following strategy. The idea is simple: stay invested when momentum is healthy, and
                  step aside when the trend weakens. A short-term average (5 {maTimeframe === "weekly" ? "weeks" : "days"}) is compared
                  against a long-term average (20 {maTimeframe === "weekly" ? "weeks" : "days"}) to detect those shifts.
                </p>
                <p>
                  Trigger rule: if <span className="font-mono text-foreground">SMA(5{maTimeframe === "weekly" ? "W" : "D"}) &gt; SMA(20{maTimeframe === "weekly" ? "W" : "D"})</span>, the model
                  stays invested; if not, it {positionMode === "long_short" ? "flips short" : "moves to cash"}. In practice, that means you can see multiple
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
                  People use this style to reduce large drawdowns in prolonged downtrends. The tradeoff is that it can
                  react late around turning points and sometimes get whipsawed in choppy markets.
                </p>
              </>
            ) : (
              <>
                <p>
                  This is a mean-reversion strategy. It measures how stretched price is from its rolling average using
                  a z-score over the selected lookback.
                </p>
                <p>
                  Trigger rule: enter long when <span className="font-mono text-foreground">z &lt;= -entry</span>, and
                  exit long when <span className="font-mono text-foreground">z &gt;= -exit</span>. If shorting is enabled,
                  the strategy also enters short at <span className="font-mono text-foreground">z &gt;= entry</span> and exits
                  short at <span className="font-mono text-foreground">z &lt;= exit</span>.
                </p>
                <p>
                  Trades execute with a one-bar lag to avoid lookahead bias. Optional stop-loss and max holding bars can
                  force earlier exits.
                </p>
              </>
            )}
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
            <PerformanceChart data={chartData} ticker={ticker} strategyLabel={strategyLabel} />
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
