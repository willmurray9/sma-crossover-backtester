import { MetricSummary, PortfolioHolding } from "@/lib/api";

interface PortfolioStatsTableProps {
  strategy: MetricSummary;
  buyAndHold: MetricSummary;
  spy: MetricSummary;
  holdings: PortfolioHolding[];
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

export function PortfolioStatsTable({ strategy, buyAndHold, spy, holdings }: PortfolioStatsTableProps) {
  const sortedHoldings = [...holdings].sort((a, b) => b.weight - a.weight);

  return (
    <div className="bg-card border border-border rounded p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Portfolio Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <StatCard
            label="Portfolio SMA Strategy"
            value={<ReturnCell value={strategy.cumulative_return * 100} />}
          />
          <StatCard
            label="User Basket Buy & Hold"
            value={<ReturnCell value={buyAndHold.cumulative_return * 100} />}
          />
          <StatCard label="SPY Buy & Hold" value={<ReturnCell value={spy.cumulative_return * 100} />} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-border pt-4">
          <MetricItem label="Strategy CAGR" value={percent(strategy.cagr)} />
          <MetricItem label="Strategy Volatility" value={percent(strategy.volatility)} />
          <MetricItem label="Strategy Sharpe" value={strategy.sharpe_ratio.toFixed(2)} />
          <MetricItem label="Strategy Max Drawdown" value={percent(strategy.max_drawdown)} />
          <MetricItem label="Basket CAGR" value={percent(buyAndHold.cagr)} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Current Holdings Snapshot
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Symbol</th>
                <th className="py-2 pr-3">In Trend</th>
                <th className="py-2 pr-3">Target Weight</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((holding) => (
                <tr key={holding.symbol} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono">{holding.symbol}</td>
                  <td className="py-2 pr-3">{holding.in_market ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 font-mono">{(holding.weight * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
