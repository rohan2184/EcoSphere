import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";
import { Select, Input } from "../../components/ui";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface EmissionsTrendPoint {
  period: string;
  total_co2e: number;
}

interface DepartmentBreakdown {
  department_id: number;
  department_name: string;
  total_co2e: number;
}

interface GoalProgress {
  id: number;
  metric: string;
  target_value: number;
  current_value: number;
  deadline: string | null;
  progress_pct: number;
  status: string;
  department_id: number | null;
}

interface DashboardData {
  total_co2e: number;
  emissions_trend: EmissionsTrendPoint[];
  department_breakdown: DepartmentBreakdown[];
  goals_progress: GoalProgress[];
}

interface Department {
  id: number;
  name: string;
}

/* ── Status helpers ─────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  on_track:  { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500",  label: "On track"  },
  at_risk:   { badge: "bg-amber-100 text-amber-800",     bar: "bg-amber-500",    label: "At risk"   },
  overdue:   { badge: "bg-red-100 text-red-700",         bar: "bg-red-500",      label: "Overdue"   },
  achieved:  { badge: "bg-indigo-100 text-indigo-800",   bar: "bg-indigo-500",   label: "Achieved"  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { badge: "bg-stone-100 text-stone-600", label: status };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ${s.badge}`}>
      {s.label}
    </span>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-2">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <SkeletonBlock className="h-4 w-40 mb-4" />
          <SkeletonBlock className="h-52 w-full" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <SkeletonBlock className="h-4 w-40 mb-4" />
          <SkeletonBlock className="h-52 w-full" />
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
        <SkeletonBlock className="h-4 w-32 mb-2" />
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ── Custom tooltip ─────────────────────────────────────────────────────── */

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function Co2eTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-stone-700">{label}</p>
      <p className="text-emerald-700 tabular-nums">
        {payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO&#8322;e
      </p>
    </div>
  );
}

/* ── Empty chart state ──────────────────────────────────────────────────── */

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-stone-200">
      <p className="text-sm text-stone-400">{message}</p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function EmissionsDashboard() {
  const [data, setData]               = useState<DashboardData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filter state
  const [deptId, setDeptId]     = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo]     = useState<string>("");

  /* Fetch department list for dropdown */
  useEffect(() => {
    api.get<Department[]>("/departments")
      .then((r) => setDepartments(r.data))
      .catch(() => {});
  }, []);

  /* Fetch dashboard data whenever any filter changes */
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params: Record<string, string> = {};
    if (deptId)   params.department_id = deptId;
    if (dateFrom) params.date_from     = dateFrom;
    if (dateTo)   params.date_to       = dateTo;

    api
      .get<DashboardData>("/env/dashboard", { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [deptId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  /* Derived counts */
  const deptCount    = data?.department_breakdown.length ?? 0;
  const goalsOnTrack = data?.goals_progress.filter(
    (g) => g.status === "on_track" || g.status === "achieved"
  ).length ?? 0;
  const goalsAtRisk  = data?.goals_progress.filter(
    (g) => g.status === "at_risk" || g.status === "overdue"
  ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Environmental Overview</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Carbon footprint, department breakdown and sustainability goals.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Department
          </label>
          <Select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Date From
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Date To
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>

        <button
          onClick={() => { setDeptId(""); setDateFrom(""); setDateTo(""); }}
          className="self-end rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>Failed to load dashboard: {error}</span>
          <button onClick={load} className="underline hover:text-red-900 ml-4">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <LoadingSkeleton />
      ) : !data ? null : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total CO&#8322;e"
              value={`${data.total_co2e.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
              sub="CO&#8322; equivalent"
              accent="text-emerald-700"
            />
            <StatCard
              label="Departments Tracked"
              value={deptCount}
              sub="with emissions data"
              accent="text-sky-700"
            />
            <StatCard
              label="Goals On Track"
              value={goalsOnTrack}
              sub="on track or achieved"
              accent="text-emerald-600"
            />
            <StatCard
              label="Goals At Risk"
              value={goalsAtRisk}
              sub="at risk or overdue"
              accent={goalsAtRisk > 0 ? "text-red-600" : "text-stone-500"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Emissions Trend – Line chart */}
            <ChartCard title="Emissions Trend (kg CO&#8322;e)">
              {data.emissions_trend.length === 0 ? (
                <EmptyChartState message="No emissions data for this date range." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.emissions_trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                    <XAxis
                      dataKey="period"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#78716c" }}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#78716c" }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <Tooltip content={<Co2eTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={() => "CO\u2082e (kg)"}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_co2e"
                      name="CO2e"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#059669", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#059669" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Department Breakdown – Horizontal bar chart */}
            <ChartCard title="Emissions by Department (kg CO&#8322;e)">
              {data.department_breakdown.length === 0 ? (
                <EmptyChartState message="No department data for this date range." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.department_breakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                    <XAxis
                      type="number"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#78716c" }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <YAxis
                      type="category"
                      dataKey="department_name"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#78716c" }}
                      width={112}
                    />
                    <Tooltip content={<Co2eTooltip />} />
                    <Bar
                      dataKey="total_co2e"
                      name="CO2e"
                      fill="#0d9488"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Goals summary */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Goals Summary</h3>
              <Link
                to="/env/goals"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                View all goals &#8594;
              </Link>
            </div>

            {data.goals_progress.length === 0 ? (
              <EmptyChartState message="No goals set. Add goals on the Goals page to track progress." />
            ) : (
              <div className="divide-y divide-stone-100">
                {data.goals_progress.map((goal) => {
                  const pct = Math.max(0, Math.min(100, goal.progress_pct));
                  const barColor = STATUS_STYLES[goal.status]?.bar ?? "bg-stone-400";
                  return (
                    <div
                      key={goal.id}
                      className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
                    >
                      {/* Metric info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">{goal.metric}</p>
                        <p className="text-xs text-stone-400 tabular-nums">
                          {goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()}
                          {goal.deadline &&
                            ` \u00b7 due ${new Date(goal.deadline + "T00:00:00").toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`}
                        </p>
                      </div>

                      {/* Inline progress bar */}
                      <div className="flex items-center gap-2 sm:w-44">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs tabular-nums text-stone-500">
                          {pct}%
                        </span>
                      </div>

                      {/* Status badge */}
                      <div className="sm:w-20 sm:text-right">
                        <StatusBadge status={goal.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
