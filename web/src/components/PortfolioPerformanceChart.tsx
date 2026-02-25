import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  date: string;
  strategyValue: number | null;
  buyHoldValue: number | null;
  spyValue: number | null;
}

interface PortfolioPerformanceChartProps {
  data: DataPoint[];
}

const formatValue = (v: number) => `$${v.toLocaleString()}`;
const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

export function PortfolioPerformanceChart({ data }: PortfolioPerformanceChartProps) {
  return (
    <div className="bg-card border border-border rounded p-5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Portfolio Value — $10,000 Initial Investment
      </h2>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="hsl(215 12% 50%)"
              tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tickFormatter={formatValue}
              stroke="hsl(215 12% 50%)"
              tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 18% 10%)",
                border: "1px solid hsl(220 14% 18%)",
                borderRadius: "4px",
                fontFamily: "IBM Plex Mono",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(215 12% 50%)" }}
              formatter={(value: number, name: string) => [formatValue(value), name]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: "12px" }} />
            <Line
              type="monotone"
              dataKey="strategyValue"
              name="Portfolio SMA Strategy"
              stroke="hsl(142 60% 45%)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="buyHoldValue"
              name="User Basket Buy & Hold"
              stroke="hsl(160 35% 55%)"
              strokeWidth={1.75}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="spyValue"
              name="SPY Buy & Hold"
              stroke="hsl(210 70% 55%)"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
