import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

interface Department extends Record<string, unknown> {
  id: number;
  name: string;
  code: string;
  head_user_id: number | null;
  parent_id: number | null;
  employee_count: number;
  status: string | null;
}

interface UserOption {
  id: number;
  name: string;
}

interface FormState {
  name: string;
  code: string;
  head_user_id: string;
  parent_id: string;
  employee_count: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  head_user_id: "",
  parent_id: "",
  employee_count: "0",
  status: "active",
};

export default function DepartmentsTab() {
  const [rows, setRows] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<Department[]>("/departments"),
      api.get<UserOption[]>("/users").catch(() => ({ data: [] as UserOption[] })),
    ])
      .then(([deptRes, usersRes]) => {
        setRows(deptRes.data);
        setUsers(usersRes.data);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: Department) {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code,
      head_user_id: row.head_user_id != null ? String(row.head_user_id) : "",
      parent_id: row.parent_id != null ? String(row.parent_id) : "",
      employee_count: String(row.employee_count),
      status: row.status ?? "",
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        head_user_id: form.head_user_id ? Number(form.head_user_id) : null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        employee_count: Number(form.employee_count),
        status: form.status || null,
      };
      if (editing) {
        await api.put(`/departments/${editing.id}`, payload);
        setToast({ message: "Department updated.", tone: "green" });
      } else {
        await api.post("/departments", payload);
        setToast({ message: "Department created.", tone: "green" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Department) {
    if (!confirm(`Delete department "${row.name}"?`)) return;
    try {
      await api.delete(`/departments/${row.id}`);
      setToast({ message: "Department deleted.", tone: "green" });
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    }
  }

  const headName = (id: number | null) =>
    users.find((u) => u.id === id)?.name ?? (id != null ? `User #${id}` : "—");
  const parentName = (id: number | null) =>
    rows.find((d) => d.id === id)?.name ?? (id != null ? `Dept #${id}` : "—");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Manage organizational departments and their hierarchy.</p>
        <Button onClick={openAdd}>+ New Department</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading departments…
        </div>
      ) : (
        <DataTable<Department>
          columns={[
            { key: "name", label: "Name" },
            { key: "code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: "head_user_id", label: "Head", render: (r) => <>{headName(r.head_user_id)}</> },
            { key: "parent_id", label: "Parent Dept", render: (r) => <>{parentName(r.parent_id)}</> },
            { key: "employee_count", label: "Employees" },
            {
              key: "status", label: "Status",
              render: (r) => <Chip tone={r.status === "active" ? "green" : "neutral"}>{r.status ?? "—"}</Chip>,
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
          empty="No departments yet — add the first one to get started."
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Department" : "Add Department"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Name</label>
              <Input
                required placeholder="e.g. Engineering"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Code</label>
              <Input
                required placeholder="e.g. ENG"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Department Head</label>
              <Select
                value={form.head_user_id}
                onChange={(e) => setForm({ ...form, head_user_id: e.target.value })}
                className="w-full"
              >
                <option value="">None</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Parent Department</label>
              <Select
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                className="w-full"
              >
                <option value="">None (top-level)</option>
                {rows
                  .filter((d) => !editing || d.id !== editing.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Employee Count</label>
              <Input
                type="number" min="0"
                value={form.employee_count}
                onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Status</label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add department"}
            </Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
