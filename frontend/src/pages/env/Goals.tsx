import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { Button, Input, Select } from "../../components/ui";

interface Department { id: number; name: string }
interface Goal {
  id: number;
  department_id: number | null;
  metric: string;
  target_value: number;
  current_value: number;
  deadline: string | null;
  status: string | null;
}

const EMPTY = { department_id: "", metric: "", target_value: "", current_value: "0", deadline: "" };

export default function Goals() {
  const [rows, setRows] = useState<Goal[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  const load = useCallback(() => {
    api.get<Goal[]>("/env/goals").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    load();
    api.get<Department[]>("/departments").then((r) => setDepts(r.data)).catch(() => {});
  }, [load]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/env/goals", {
        department_id: form.department_id ? Number(form.department_id) : null,
        metric: form.metric,
        target_value: Number(form.target_value),
        current_value: Number(form.current_value),
        deadline: form.deadline || null,
        status: "active",
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this goal?")) return;
    try {
      await api.delete(`/env/goals/${id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Environmental Goals</h1>
      <p className="text-sm text-stone-500">A department scores 100 on Environmental when all its goals are met.</p>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
          <option value="">Org-wide</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Input required placeholder="Metric (e.g. renewable_kwh)" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="w-52" />
        <Input required type="number" step="any" placeholder="Target" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} className="w-28" />
        <Input required type="number" step="any" placeholder="Current" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} className="w-28" />
        <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        <Button type="submit">Add goal</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 shadow-sm">
          No goals yet — add the first one above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((g) => {
            const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
            const met = g.current_value >= g.target_value;
            return (
              <div key={g.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-stone-800">{g.metric}</div>
                    <div className="text-xs text-stone-500">
                      {g.department_id ? deptName.get(g.department_id) ?? `Dept ${g.department_id}` : "Org-wide"}
                      {g.deadline && ` · due ${g.deadline}`}
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => remove(g.id)}>Delete</Button>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full rounded-full ${met ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-stone-500">
                  <span>{g.current_value} / {g.target_value}</span>
                  <span className={met ? "font-medium text-emerald-700" : ""}>{met ? "met" : `${pct.toFixed(0)}%`}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
