import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import EmptyState from "../../components/EmptyState";
import { Button, Dialog, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ToastProvider";

const STATUSES = ["on_track", "at_risk", "overdue", "achieved"] as const;
type Status = (typeof STATUSES)[number];

// at_risk / overdue surface first; achieved sinks to the bottom.
const STATUS_ORDER: Record<string, number> = {
  overdue: 0,
  at_risk: 1,
  on_track: 2,
  achieved: 3,
};

const STATUS_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  on_track: { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500", label: "On track" },
  at_risk: { badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500", label: "At risk" },
  overdue: { badge: "bg-red-100 text-red-700", bar: "bg-red-500", label: "Overdue" },
  achieved: { badge: "bg-indigo-100 text-indigo-800", bar: "bg-indigo-500", label: "Achieved" },
};

interface Goal {
  id: number;
  department_id: number | null;
  metric: string;
  target_value: number;
  current_value: number;
  deadline: string | null;
  progress_pct: number;
  status: string;
}

interface Department {
  id: number;
  name: string;
}

interface DashboardResponse {
  goals_progress: Goal[];
}

interface FormState {
  department_id: string; // "" = Organization-wide (null)
  metric: string;
  target_value: string;
  current_value: string;
  deadline: string;
  status: Status;
}

const EMPTY_FORM: FormState = {
  department_id: "",
  metric: "",
  target_value: "",
  current_value: "0",
  deadline: "",
  status: "on_track",
};

function formatDate(d: string | null): string {
  if (!d) return "No deadline";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { badge: "bg-stone-100 text-stone-600", label: status };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
      {style.label ?? status}
    </span>
  );
}

function GoalCard({
  goal,
  deptName,
  onUpdated,
  onDelete,
}: {
  goal: Goal;
  deptName: (id: number) => string;
  onUpdated: () => void;
  onDelete: (goal: Goal) => void;
}) {
  const { showToast } = useToast();
  const [value, setValue] = useState(String(goal.current_value));
  const [saving, setSaving] = useState(false);

  // Keep the input in sync if the goal is refreshed from the server.
  useEffect(() => {
    setValue(String(goal.current_value));
  }, [goal.current_value]);

  const pct = Math.max(0, Math.min(100, goal.progress_pct));
  const bar = STATUS_STYLES[goal.status]?.bar ?? "bg-stone-400";

  async function saveProgress(e: React.FormEvent) {
    e.preventDefault();
    if (value === "" || Number(value) === goal.current_value) return;
    setSaving(true);
    try {
      await api.put(`/env/goals/${goal.id}`, { current_value: Number(value) });
      showToast("Progress updated.", "green");
      onUpdated();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-stone-800">{goal.metric}</h3>
          <p className="text-xs text-stone-500">
            {goal.department_id === null ? "Organization-wide" : deptName(goal.department_id)}
          </p>
        </div>
        <StatusBadge status={goal.status} />
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="tabular-nums font-medium text-stone-700">
            {goal.current_value} / {goal.target_value}
          </span>
          <span className="tabular-nums text-xs text-stone-500">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="mt-3 text-xs text-stone-500">Deadline: {formatDate(goal.deadline)}</p>

      <div className="mt-4 flex items-end gap-2 border-t border-stone-100 pt-3">
        <form onSubmit={saveProgress} className="flex flex-1 items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium text-stone-500">Update progress</label>
            <Input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? "…" : "Save"}
          </Button>
        </form>
        <Button variant="ghost" onClick={() => onDelete(goal)} className="text-red-600 hover:bg-red-50">
          Delete
        </Button>
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className}`} />;
}

export default function Goals() {
  const { showToast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [departments]);


  useEffect(() => {
    api.get<Department[]>("/departments").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    // /dashboard already returns goals_progress with computed progress_pct + status.
    api
      .get<DashboardResponse>("/env/dashboard")
      .then((r) => setGoals(r.data.goals_progress ?? []))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 2;
      const bo = STATUS_ORDER[b.status] ?? 2;
      if (ao !== bo) return ao - bo;
      return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
    });
  }, [goals]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        department_id: form.department_id ? Number(form.department_id) : null,
        metric: form.metric,
        target_value: Number(form.target_value),
        current_value: form.current_value === "" ? 0 : Number(form.current_value),
        deadline: form.deadline || null,
        status: form.status,
      };
      await api.post("/env/goals", payload);
      showToast("Goal added.", "green");
      setDialogOpen(false);
      load();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSaving(false);
    }
  }

  async function remove(goal: Goal) {
    if (!confirm(`Delete goal "${goal.metric}"?`)) return;
    try {
      await api.delete(`/env/goals/${goal.id}`);
      showToast("Goal deleted.", "green");
      load();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Environmental Goals</h1>
          <p className="text-sm text-stone-500">Track progress toward emission and sustainability targets.</p>
        </div>
        <Button onClick={openAdd}>+ Add Goal</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-28 w-full" />)}
        </div>
      ) : sortedGoals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No goals set yet"
          description="Add an environmental goal to start tracking your team's sustainability progress."
          actionLabel="+ Add Goal"
          onAction={openAdd}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              deptName={deptName}
              onUpdated={load}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Goal">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Department</label>
            <Select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full"
            >
              <option value="">Organization-wide</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Metric</label>
            <Input
              required
              placeholder="e.g. total_co2e"
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Target Value</label>
              <Input
                required
                type="number"
                step="any"
                placeholder="e.g. 5000"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Current Value</label>
              <Input
                type="number"
                step="any"
                value={form.current_value}
                onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Deadline</label>
              <Input
                required
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Status</label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                className="w-full"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add goal"}</Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
}
