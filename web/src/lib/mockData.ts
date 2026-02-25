// Generate mock performance data for SMA 5w/20w crossover strategy

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface WeeklyDataPoint {
  date: string;
  strategyValue: number;
  spyValue: number;
  diaValue: number;
  qqqValue: number;
}

interface TradeRecord {
  type: "BUY" | "SELL";
  date: string;
  price: number;
}

interface StrategyResult {
  weeklyData: WeeklyDataPoint[];
  trades: TradeRecord[];
  stats: {
    ticker: string;
    strategyReturn: number;
    spyReturn: number;
    diaReturn: number;
    qqqReturn: number;
    numBuys: number;
    numSells: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    avgHoldingPeriod: number;
  };
}

function hashTicker(ticker: string): number {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) % 2147483647;
  }
  return Math.max(1, hash);
}

export function generateStrategyData(ticker: string): StrategyResult {
  const rand = seededRandom(hashTicker(ticker.toUpperCase()));
  const weeks = 156; // ~3 years
  const startDate = new Date("2022-01-03");

  // Generate base price series with trend + noise
  const tickerTrend = 0.001 + rand() * 0.003;
  const tickerVol = 0.02 + rand() * 0.03;

  let prices: number[] = [100];
  for (let i = 1; i < weeks; i++) {
    const ret = tickerTrend + tickerVol * (rand() - 0.5) * 2;
    prices.push(prices[i - 1] * (1 + ret));
  }

  // Compute SMAs
  const sma5: (number | null)[] = prices.map((_, i) =>
    i < 4 ? null : prices.slice(i - 4, i + 1).reduce((a, b) => a + b) / 5
  );
  const sma20: (number | null)[] = prices.map((_, i) =>
    i < 19 ? null : prices.slice(i - 19, i + 1).reduce((a, b) => a + b) / 20
  );

  // Generate strategy equity curve
  let inPosition = false;
  let strategyValue = 10000;
  let shares = 0;
  let entryPrice = 0;
  const trades: TradeRecord[] = [];
  const strategyValues: number[] = [];
  let wins = 0;
  let totalClosedTrades = 0;
  let holdingWeeks = 0;
  let totalHoldingWeeks = 0;

  for (let i = 0; i < weeks; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 7);
    const dateStr = date.toISOString().split("T")[0];

    if (sma5[i] !== null && sma20[i] !== null) {
      const prevSma5 = i > 0 ? sma5[i - 1] : null;
      const prevSma20 = i > 0 ? sma20[i - 1] : null;

      // Golden cross: buy
      if (!inPosition && prevSma5 !== null && prevSma20 !== null && prevSma5 <= prevSma20 && sma5[i]! > sma20[i]!) {
        inPosition = true;
        shares = strategyValue / prices[i];
        entryPrice = prices[i];
        trades.push({ type: "BUY", date: dateStr, price: prices[i] });
        holdingWeeks = 0;
      }
      // Death cross: sell
      else if (inPosition && prevSma5 !== null && prevSma20 !== null && prevSma5 >= prevSma20 && sma5[i]! < sma20[i]!) {
        strategyValue = shares * prices[i];
        if (prices[i] > entryPrice) wins++;
        totalClosedTrades++;
        totalHoldingWeeks += holdingWeeks;
        inPosition = false;
        shares = 0;
        trades.push({ type: "SELL", date: dateStr, price: prices[i] });
      }
    }

    if (inPosition) {
      holdingWeeks++;
      strategyValues.push(shares * prices[i]);
    } else {
      strategyValues.push(strategyValue);
    }
  }

  // Generate index series
  const spyGrowth = 0.0015;
  const diaGrowth = 0.0012;
  const qqqGrowth = 0.002;

  const spy: number[] = [10000];
  const dia: number[] = [10000];
  const qqq: number[] = [10000];
  const rand2 = seededRandom(42);

  for (let i = 1; i < weeks; i++) {
    spy.push(spy[i - 1] * (1 + spyGrowth + 0.015 * (rand2() - 0.5) * 2));
    dia.push(dia[i - 1] * (1 + diaGrowth + 0.014 * (rand2() - 0.5) * 2));
    qqq.push(qqq[i - 1] * (1 + qqqGrowth + 0.02 * (rand2() - 0.5) * 2));
  }

  // Build weekly data
  const weeklyData: WeeklyDataPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 7);
    weeklyData.push({
      date: date.toISOString().split("T")[0],
      strategyValue: Math.round(strategyValues[i]),
      spyValue: Math.round(spy[i]),
      diaValue: Math.round(dia[i]),
      qqqValue: Math.round(qqq[i]),
    });
  }

  // Max drawdown
  let peak = 0;
  let maxDD = 0;
  for (const v of strategyValues) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const finalStrategy = strategyValues[strategyValues.length - 1];

  return {
    weeklyData,
    trades,
    stats: {
      ticker: ticker.toUpperCase(),
      strategyReturn: ((finalStrategy - 10000) / 10000) * 100,
      spyReturn: ((spy[weeks - 1] - 10000) / 10000) * 100,
      diaReturn: ((dia[weeks - 1] - 10000) / 10000) * 100,
      qqqReturn: ((qqq[weeks - 1] - 10000) / 10000) * 100,
      numBuys: trades.filter((t) => t.type === "BUY").length,
      numSells: trades.filter((t) => t.type === "SELL").length,
      winRate: totalClosedTrades > 0 ? (wins / totalClosedTrades) * 100 : 0,
      maxDrawdown: maxDD * 100,
      sharpeRatio: Math.round((0.5 + rand() * 2) * 100) / 100,
      totalTrades: trades.length,
      avgHoldingPeriod: totalClosedTrades > 0 ? Math.round(totalHoldingWeeks / totalClosedTrades) : 0,
    },
  };
}
