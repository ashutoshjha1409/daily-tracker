'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'

interface WeeklyPoint {
  name: string
  discipline: number
  overload: number
}

interface WeeklyChartProps {
  data: WeeklyPoint[]
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Weekly volatility</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 10 }}>
            <defs>
              <linearGradient id="discipline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="overload" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0f172a" strokeDasharray="4 4" />
            <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} domain={[0, 150]} />
            <Tooltip
              contentStyle={{ background: '#020617', borderColor: '#334155', borderRadius: 12 }}
              formatter={(value: number) => `${value.toFixed(0)}%`}
            />
            <Area type="monotone" dataKey="discipline" stroke="#22c55e" fill="url(#discipline)" strokeWidth={2} />
            <Area type="monotone" dataKey="overload" stroke="#f87171" fill="url(#overload)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
