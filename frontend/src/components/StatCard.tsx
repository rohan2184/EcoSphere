export default function StatCard({
  label,
  value,
  sub,
  accent = "text-emerald-700",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-400">{sub}</div>}
    </div>
  );
}
