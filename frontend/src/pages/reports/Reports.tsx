import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Input, Select } from "../../components/ui";

const MODULES = ["summary", "env", "social", "gamification", "governance"];

interface DeptScore { department_id: number; department_name: string }
interface ReportResult { module: string; columns: string[]; rows: Record<string, unknown>[]; count: number }

export default function Reports() {
  const [departments, setDepartments] = useState<DeptScore[]>([]);
  const [filters, setFilters] = useState({
    module: "summary", department_id: "", employee_id: "", challenge_id: "", date_from: "", date_to: "",
  });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<DeptScore[]>("/dashboard/scores").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  function payload() {
    return {
      module: filters.module,
      department_id: filters.department_id ? Number(filters.department_id) : null,
      employee_id: filters.employee_id ? Number(filters.employee_id) : null,
      challenge_id: filters.challenge_id ? Number(filters.challenge_id) : null,
      date_from: filters.date_from || null,
      date_to: filters.date_to || null,
    };
  }

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<ReportResult>("/reports/custom", payload());
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function exportUrl(format: string) {
    const params = new URLSearchParams({ format, module: filters.module });
    for (const [k, v] of Object.entries(payload())) {
      if (v !== null && k !== "module") params.set(k, String(v));
    }
    return `${api.defaults.baseURL}/reports/custom/export?${params}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Custom Report Builder</h1>
        <p className="text-sm text-stone-500">Filter any module's data, then export as CSV, Excel or PDF.</p>
      </div>

      <form onSubmit={run} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <label className="text-sm text-stone-600">
          Module
          <Select value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} className="mt-1 block">
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </label>
        <label className="text-sm text-stone-600">
          Department
          <Select value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value })} className="mt-1 block">
            <option value="">All</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </Select>
        </label>
        <label className="text-sm text-stone-600">
          Employee id
          <Input value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })} className="mt-1 block w-28" />
        </label>
        <label className="text-sm text-stone-600">
          Challenge id
          <Input value={filters.challenge_id} onChange={(e) => setFilters({ ...filters, challenge_id: e.target.value })} className="mt-1 block w-28" />
        </label>
        <label className="text-sm text-stone-600">
          From
          <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="mt-1 block" />
        </label>
        <label className="text-sm text-stone-600">
          To
          <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="mt-1 block" />
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Running…" : "Run report"}</Button>
        <div className="ml-auto flex gap-2">
          {["csv", "xlsx", "pdf"].map((f) => (
            <a key={f} href={exportUrl(f)} download>
              <Button type="button" variant="outline">⬇ {f.toUpperCase()}</Button>
            </a>
          ))}
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <>
          <p className="text-sm text-stone-500">{result.count} row(s) · module: {result.module}</p>
          <DataTable
            columns={result.columns.map((c) => ({ key: c, label: c.replaceAll("_", " ") }))}
            rows={result.rows}
            empty="Report returned no rows for these filters."
          />
        </>
      )}
    </div>
  );
}
