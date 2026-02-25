import { Info } from "lucide-react";

import { MetricSummary, SeriesResult } from "@/lib/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StatsTableProps {
  ticker: string;
  strategy: MetricSummary;
  buyAndHold: MetricSummary;
  benchmarks: SeriesResult[];
}

interface MetricDefinition {
  label: string;
  short: string;
  detail: string;
}

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  cagr: {
    label: "CAGR",
    short: "Average annual growth rate over the selected horizon.",
    detail:
      "Calculated from cumulative growth and annualized using weekly periods. It smooths the path into one annual rate.",
  },
  volatility: {
    label: "Volatility",
    short: "Annualized variability of weekly returns.",
    detail:
      "Computed as the standard deviation of weekly returns multiplied by sqrt(52). Higher means returns vary more.",
  },
  sharpe: {
    label: "Sharpe",
    short: "Return per unit of volatility (risk-adjusted return).",
    detail:
      "Computed as annualized mean return divided by annualized volatility, with a zero risk-free-rate assumption.",
  },
  max_drawdown: {
    label: "Max Drawdown",
    short: "Worst peak-to-trough decline during the selected horizon.",
    detail:
      "At each point, drawdown is equity / running peak - 1. Max drawdown is the most negative value in that series.",
  },
  buy_hold_cagr: {
    label: "Buy & Hold CAGR",
    short: "Annualized growth rate for buying once and holding the ticker.",
    detail:
      "Uses the same CAGR formula as strategy CAGR, but on the ticker buy-and-hold return stream for comparison.",
  },
  cumulative_return: {
    label: "Cumulative Return",
    short: "Total percent gain/loss over the selected horizon.",
    detail:
      "Calculated as final equity / initial equity - 1, then shown as a percentage.",
  },
};

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
          definition={METRIC_DEFINITIONS.cumulative_return}
        />
        <StatCard
          label={`${ticker} Buy & Hold`}
          value={<ReturnCell value={buyAndHold.cumulative_return * 100} />}
          definition={METRIC_DEFINITIONS.cumulative_return}
        />
        <StatCard
          label="SPY (S&P 500)"
          value={<ReturnCell value={spy * 100} />}
          definition={METRIC_DEFINITIONS.cumulative_return}
        />
        <StatCard
          label="DIA (DJIA)"
          value={<ReturnCell value={dia * 100} />}
          definition={METRIC_DEFINITIONS.cumulative_return}
        />
        <StatCard
          label="QQQ (Nasdaq)"
          value={<ReturnCell value={qqq * 100} />}
          definition={METRIC_DEFINITIONS.cumulative_return}
        />
      </div>

      <div className="border-t border-border pt-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricItem definition={METRIC_DEFINITIONS.cagr} value={percent(strategy.cagr)} />
          <MetricItem definition={METRIC_DEFINITIONS.volatility} value={percent(strategy.volatility)} />
          <MetricItem definition={METRIC_DEFINITIONS.sharpe} value={strategy.sharpe_ratio.toFixed(2)} />
          <MetricItem definition={METRIC_DEFINITIONS.max_drawdown} value={percent(strategy.max_drawdown)} />
          <MetricItem definition={METRIC_DEFINITIONS.buy_hold_cagr} value={percent(buyAndHold.cagr)} />
        </div>
      </div>

      <Collapsible className="border-t border-border pt-4 mt-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            View Metric Methodology
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            Returns are computed on weekly bars for the selected horizon. Strategy returns apply the
            SMA position rule with a one-bar lag. Values shown do not include fees, taxes, or slippage.
          </p>
          <p>
            Cumulative Return = final equity / initial equity - 1. CAGR annualizes growth over the
            number of weekly periods. Volatility is std-dev(weekly returns) * sqrt(52). Sharpe uses
            annualized mean return / annualized volatility with risk-free rate assumed as 0.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StatCard({
  label,
  value,
  definition,
}: {
  label: string;
  value: React.ReactNode;
  definition: MetricDefinition;
}) {
  return (
    <div className="bg-secondary rounded p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <MetricInfo definition={definition} />
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MetricItem({ definition, value }: { definition: MetricDefinition; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
        <span>{definition.label}</span>
        <MetricInfo definition={definition} />
      </div>
      <div className="font-mono text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function MetricInfo({ definition }: { definition: MetricDefinition }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`More info about ${definition.label}`}
          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <p className="text-xs font-semibold text-foreground mb-1">{definition.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{definition.short}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-2">{definition.detail}</p>
      </PopoverContent>
    </Popover>
  );
}
