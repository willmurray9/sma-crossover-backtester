import { MetricSummary, SeriesResult } from "@/lib/api";

interface StatsTableProps {
  ticker: string;
  strategy: MetricSummary;
  buyAndHold: MetricSummary;
  benchmarks: SeriesResult[];
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function ReturnCell({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`font-mono ${isPositive ? "text-gain" : "text-loss"}`}>
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function StatsTable({ ticker, strategy, buyAndHold, benchmarks }: StatsTableProps) {
  const benchmarkMap = new Map(benchmarks.map((b) => [b.symbol, b]));
  const spy = benchmarkMap.get("SPY")?.metrics.cumulative_return ?? 0;
  const dia = benchmarkMap.get("DIA")?.metrics.cumulative_return ?? 0;
  const qqq = benchmarkMap.get("QQQ")?.metrics.cumulative_return ?? 0;

  return (
    <div className="bg-card border border-border rounded p-5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Strategy Statistics
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          label={`${ticker} SMA Strategy`}
          value={<ReturnCell value={strategy.cumulative_return * 100} />}
        />
        <StatCard
          label={`${ticker} Buy & Hold`}
          value={<ReturnCell value={buyAndHold.cumulative_return * 100} />}
        />
        <StatCard label="SPY (S&P 500)" value={<ReturnCell value={spy * 100} />} />
        <StatCard label="DIA (DJIA)" value={<ReturnCell value={dia * 100} />} />
        <StatCard label="QQQ (Nasdaq)" value={<ReturnCell value={qqq * 100} />} />
      </div>

      <div className="border-t border-border pt-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricItem label="CAGR" value={percent(strategy.cagr)} />
          <MetricItem label="Volatility" value={percent(strategy.volatility)} />
          <MetricItem label="Sharpe" value={strategy.sharpe_ratio.toFixed(2)} />
          <MetricItem label="Max Drawdown" value={percent(strategy.max_drawdown)} />
          <MetricItem label="Buy & Hold CAGR" value={percent(buyAndHold.cagr)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-secondary rounded p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-mono text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
