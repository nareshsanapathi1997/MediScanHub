"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const shortDay = (key: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
const inr = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label && /^\d{4}-/.test(label) ? shortDay(label) : label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-muted-foreground">
          {item.dataKey === "revenuePaise" ? "Booked value" : item.name}: <span className="font-medium text-foreground">{item.dataKey === "revenuePaise" ? inr(item.value) : item.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, metric = "bookings" }: { data: Array<{ day: string; bookings: number; revenuePaise?: number }>; metric?: "bookings" | "revenuePaise" }) {
  const empty = data.every((row) => (row[metric] ?? 0) === 0);
  return (
    <div className="relative h-64 w-full" role="img" aria-label={`${metric === "bookings" ? "Bookings" : "Booked value"} per day`}>
      {empty ? <p className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">No activity in this period yet.</p> : null}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis allowDecimals={false} width={metric === "revenuePaise" ? 64 : 28} tickFormatter={metric === "revenuePaise" ? (v: number) => inr(v) : undefined} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" name="Bookings" dataKey={metric} stroke="var(--color-chart-1)" strokeWidth={2} fill={`url(#fill-${metric})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const PALETTE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function StatusBars({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Nothing to chart yet.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label="Counts by status">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]}>
            {data.map((row, index) => <Cell key={row.label} fill={PALETTE[index % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
