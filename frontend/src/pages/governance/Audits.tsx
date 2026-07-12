import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

interface Audit extends Record<string, unknown> {
  id: number;
  title: string;
  department_id: number | null;
  auditor_id: number | null;
  date: string | null;
  scope: string | null;
  result: string | null;
}

interface DeptOption { department_id: number; department_name: string }

interface FormState {
  title: string;
  department_id: string;
  auditor_id: string;
  date: string;
  scope: string;
  result: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  department_id: "",
  auditor_id: "",
  date: "",
  scope: "",
  result: "",
};

export default function Audits() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Audit | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<Audit[]>("/governance/audits"),
      api.get<DeptOption[]>("/dashboard/scores").catch(() => ({ data: [] as DeptOption[] })),
    ])
      .then(([auditsRes, deptRes]) => {
        setRows(auditsRes.data);
        setDepartments(deptRes.data);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const deptName = (id: number | null) =>
    departments.find((d) => d.department_id === id)?.department_name ?? (id ?? "—");

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: Audit) {
    setEditing(row);
    setForm({
      title: row.title,
      department_id: row.department_id != null ? String(row.department_id) : "",
      auditor_id: row.auditor_id != null ? String(row.auditor_id) : "",
      date: row.date ?? "",
      scope: row.scope ?? "",
      result: row.result ?? "",
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        department_id: form.department_id ? Number(form.department_id) : null,
        auditor_id: form.auditor_id ? Number(form.auditor_id) : null,
        date: form.date || null,
        scope: form.scope || null,
        result: form.result || null,
      };
      if (editing) {
        await api.put(`/governance/audits/${editing.id}`, payload);
        setToast({ message: "Audit updated.", tone: "green" });
      } else {
        await api.post("/governance/audits", payload);
        setToast({ message: "Audit created.", tone: "green" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Audit) {
    if (!confirm(`Delete audit "${row.title}"?`)) return;
    try {
      await api.delete(`/governance/audits/${row.id}`);
      setToast({ message: "Audit deleted.", tone: "green" });
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Audits</h1>
          <p className="text-sm text-stone-500">Manage governance audits across departments.</p>
        </div>
        <Button onClick={openAdd}>+ Add Audit</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading audits…
        </div>
      ) : (
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
            {
              key: "actions", label: "",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                  <Button variant="danger" onClick={() => remove(r)}>Delete</Button>
                </div>
              ),
            },
          ]}
          rows={rows}
          empty="No audits yet — add the first one to get started."
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Audit" : "Add Audit"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Title</label>
            <Input
              required placeholder="Audit title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Department</label>
              <Select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full"
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Auditor User ID</label>
              <Input
                placeholder="e.g. 1"
                value={form.auditor_id}
                onChange={(e) => setForm({ ...form, auditor_id: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Scope</label>
              <Input
                placeholder="e.g. ISO 14001"
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Result</label>
            <Select
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              className="w-full"
            >
              <option value="">Select result…</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="observations">Observations</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add audit"}
            </Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
