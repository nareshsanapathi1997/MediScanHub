"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: Array<{ day: string; bookings: number; revenuePaise?: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} width={28} />
          <Tooltip />
          <Area type="monotone" dataKey="bookings" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
