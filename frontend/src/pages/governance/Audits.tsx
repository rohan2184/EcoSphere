import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Input, Select } from "../../components/ui";

interface Audit extends Record<string, unknown> {
  id: number;
  title: string;
  department_id: number | null;
  auditor_id: number | null;
  date: string | null;
  scope: string | null;
  result: string | null;
}

interface DeptScore { department_id: number; department_name: string }

export default function Audits() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [departments, setDepartments] = useState<DeptScore[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", department_id: "", auditor_id: "", date: "", scope: "", result: "" });

  const load = useCallback(() => {
    api.get<Audit[]>("/governance/audits").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
    // dept names come from dashboard scores until Person A lands /departments
    api.get<DeptScore[]>("/dashboard/scores").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const deptName = (id: number | null) =>
    departments.find((d) => d.department_id === id)?.department_name ?? (id ?? "—");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/governance/audits", {
        title: form.title,
        department_id: form.department_id ? Number(form.department_id) : null,
        auditor_id: form.auditor_id ? Number(form.auditor_id) : null,
        date: form.date || null,
        scope: form.scope || null,
        result: form.result || null,
      });
      setForm({ title: "", department_id: "", auditor_id: "", date: "", scope: "", result: "" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Audits</h1>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Input required placeholder="Audit title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-52" />
        <Select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
          <option value="">Department…</option>
          {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
        </Select>
        <Input placeholder="Auditor user id" value={form.auditor_id} onChange={(e) => setForm({ ...form, auditor_id: e.target.value })} className="w-32" />
        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Input placeholder="Scope" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-32" />
        <Select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
          <option value="">Result…</option>
          <option value="pass">pass</option>
          <option value="fail">fail</option>
          <option value="observations">observations</option>
        </Select>
        <Button type="submit">Add audit</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable<Audit>
        columns={[
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "department_id", label: "Department", render: (r) => <>{deptName(r.department_id)}</> },
          { key: "date", label: "Date" },
          { key: "scope", label: "Scope" },
          {
            key: "result", label: "Result",
            render: (r) => r.result
              ? <Chip tone={r.result === "pass" ? "green" : r.result === "fail" ? "red" : "amber"}>{r.result}</Chip>
              : <>—</>,
          },
        ]}
        rows={rows}
        empty="No audits yet — add the first one above."
      />
    </div>
  );
}
