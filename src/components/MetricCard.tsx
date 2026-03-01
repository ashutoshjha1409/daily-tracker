interface MetricCardProps {
  label: string
  value: string | number
  density?: string
  accent?: string
}

export default function MetricCard({ label, value, density, accent }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {density && <p className="mt-1 text-sm text-slate-400">{density}</p>}
      {accent && <div className="mt-4 text-xs font-semibold uppercase text-accent">{accent}</div>}
    </div>
  )
}
