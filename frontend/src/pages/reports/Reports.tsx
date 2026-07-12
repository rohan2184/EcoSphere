import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import TabBar from "../../components/TabBar";
import { Button, Input, Select } from "../../components/ui";

interface DeptScore { department_id: number; department_name: string }
interface ReportResult { module: string; columns: string[]; rows: Record<string, unknown>[]; count: number }

// Canned reports (wireframe ⑥) — each maps to GET /reports/{module}.
const CANNED = [
  { key: "env", label: "Environmental", icon: "🌱", blurb: "Emissions, goals, and product/vendor breakdown." },
  { key: "social", label: "Social", icon: "👥", blurb: "Diversity, CSR participation, and training completion." },
  { key: "governance", label: "Governance", icon: "🏛", blurb: "Policies, audits, compliance, and risk." },
  { key: "summary", label: "ESG Summary", icon: "📊", blurb: "All four scores plus department comparison." },
] as const;

const TABS = [
  ...CANNED.map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: "custom", label: "Custom Builder", icon: "🛠" },
];

// Shared blob-download helper — fetched via axios so the Bearer token is attached.
async function downloadExport(params: URLSearchParams, filenameBase: string, format: string) {
  params.set("format", format);
  const res = await api.get(`/reports/custom/export?${params}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [tab, setTab] = useState<string>("summary");
  const [departments, setDepartments] = useState<DeptScore[]>([]);

  useEffect(() => {
    api.get<DeptScore[]>("/dashboard/scores").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Reports & Analytics</h1>
        <p className="text-sm text-stone-500">
          Generate a canned report per module, or build a custom one — export any as CSV, Excel or PDF.
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={tab} onChange={setTab} />

      {tab === "custom" ? (
        <CustomBuilder departments={departments} />
      ) : (
        <CannedReport
          key={tab}
          meta={CANNED.find((c) => c.key === tab)!}
          departments={departments}
        />
      )}
    </div>
  );
}

/* ── Canned per-module report ──────────────────────────────────────────── */

function CannedReport({
  meta,
  departments,
}: {
  meta: (typeof CANNED)[number];
  departments: DeptScore[];
}) {
  const [filters, setFilters] = useState({ department_id: "", date_from: "", date_to: "" });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function queryParams() {
    const p = new URLSearchParams({ module: meta.key });
    if (filters.department_id) p.set("department_id", filters.department_id);
    if (filters.date_from) p.set("date_from", filters.date_from);
    if (filters.date_to) p.set("date_to", filters.date_to);
    return p;
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get<ReportResult>(`/reports/${meta.key}?${queryParams()}`);
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(format: string) {
    setError("");
    try {
      await downloadExport(queryParams(), `${meta.key}-report`, format);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h2 className="text-lg font-semibold text-stone-800">{meta.label} Report</h2>
            <p className="text-sm text-stone-500">{meta.blurb}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm text-stone-600">
            Department
            <Select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="mt-1 block"
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-stone-600">
            From
            <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="mt-1 block" />
          </label>
          <label className="text-sm text-stone-600">
            To
            <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="mt-1 block" />
          </label>
          <Button type="button" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "▶ Generate"}
          </Button>
          <div className="ml-auto flex gap-2">
            {["csv", "xlsx", "pdf"].map((f) => (
              <Button key={f} type="button" variant="outline" onClick={() => exportReport(f)}>⬇ {f.toUpperCase()}</Button>
            ))}
          </div>
        </div>
      </div>

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

/* ── Custom report builder ─────────────────────────────────────────────── */

const MODULES = ["summary", "env", "social", "gamification", "governance"];

function CustomBuilder({ departments }: { departments: DeptScore[] }) {
  const [filters, setFilters] = useState({
    module: "summary", department_id: "", employee_id: "", challenge_id: "", date_from: "", date_to: "",
  });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function exportReport(format: string) {
    setError("");
    const params = new URLSearchParams({ module: filters.module });
    for (const [k, v] of Object.entries(payload())) {
      if (v !== null && k !== "module") params.set(k, String(v));
    }
    try {
      await downloadExport(params, `${filters.module}-report`, format);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
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
            <Button key={f} type="button" variant="outline" onClick={() => exportReport(f)}>⬇ {f.toUpperCase()}</Button>
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
