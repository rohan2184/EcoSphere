import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Input, Select } from "../../components/ui";

interface Issue extends Record<string, unknown> {
  id: number;
  audit_id: number;
  severity: string;
  description: string;
  owner_id: number;
  due_date: string;
  status: string;
  is_overdue: boolean;
}

interface AuditRef { id: number; title: string }

const SEVERITY_TONE = { low: "neutral", med: "amber", high: "red", critical: "red" } as const;

export default function ComplianceIssues() {
  const [rows, setRows] = useState<Issue[]>([]);
  const [audits, setAudits] = useState<AuditRef[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ audit_id: "", severity: "med", description: "", owner_id: "", due_date: "" });

  const load = useCallback(() => {
    api.get<Issue[]>("/governance/compliance-issues").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
    api.get<AuditRef[]>("/governance/audits").then((r) => setAudits(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/governance/compliance-issues", {
        audit_id: Number(form.audit_id),
        severity: form.severity,
        description: form.description,
        owner_id: Number(form.owner_id),   // owner + due date are mandatory (plan §5)
        due_date: form.due_date,
      });
      setForm({ audit_id: "", severity: "med", description: "", owner_id: "", due_date: "" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function setStatus(id: number, status: string) {
    setError("");
    try {
      await api.put(`/governance/compliance-issues/${id}`, { status });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Compliance Issues</h1>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Select required value={form.audit_id} onChange={(e) => setForm({ ...form, audit_id: e.target.value })}>
          <option value="">Audit…</option>
          {audits.map((a) => <option key={a.id} value={a.id}>#{a.id} {a.title}</option>)}
        </Select>
        <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
          {["low", "med", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-64" />
        <Input required placeholder="Owner user id" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} className="w-32" />
        <Input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <Button type="submit">Raise issue</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable<Issue>
        columns={[
          { key: "id", label: "ID" },
          { key: "severity", label: "Severity", render: (r) => <Chip tone={SEVERITY_TONE[r.severity as keyof typeof SEVERITY_TONE]}>{r.severity}</Chip> },
          { key: "description", label: "Description" },
          { key: "owner_id", label: "Owner" },
          {
            key: "due_date", label: "Due",
            render: (r) => (
              <span className={r.is_overdue ? "font-semibold text-red-600" : ""}>
                {r.due_date}{r.is_overdue && " · OVERDUE"}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r) => <Chip tone={r.status === "resolved" ? "green" : r.status === "in_progress" ? "amber" : "neutral"}>{r.status}</Chip> },
          {
            key: "actions", label: "",
            render: (r) =>
              r.status !== "resolved" ? (
                <div className="flex gap-2">
                  {r.status === "open" && <Button variant="outline" onClick={() => setStatus(r.id, "in_progress")}>Start</Button>}
                  <Button onClick={() => setStatus(r.id, "resolved")}>Resolve</Button>
                </div>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No compliance issues — either great governance or no audits yet."
      />
    </div>
  );
}
