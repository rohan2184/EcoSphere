import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

const CATEGORY_TYPES = ["csr_activity", "challenge"] as const;
type CategoryType = (typeof CATEGORY_TYPES)[number];

interface Category extends Record<string, unknown> {
  id: number;
  name: string;
  type: CategoryType;
  status: string | null;
}

interface FormState {
  name: string;
  type: CategoryType;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "csr_activity",
  status: "active",
};

export default function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<Category[]>("/categories")
      .then((r) => setRows(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: Category) {
    setEditing(row);
    setForm({
      name: row.name,
      type: row.type,
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
        type: form.type,
        status: form.status || null,
      };
      if (editing) {
        await api.put(`/categories/${editing.id}`, payload);
        setToast({ message: "Category updated.", tone: "green" });
      } else {
        await api.post("/categories", payload);
        setToast({ message: "Category created.", tone: "green" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Category) {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    try {
      await api.delete(`/categories/${row.id}`);
      setToast({ message: "Category deleted.", tone: "green" });
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">CSR activity and challenge categories.</p>
        <Button onClick={openAdd}>+ New Category</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading categories…
        </div>
      ) : (
        <DataTable<Category>
          columns={[
            { key: "name", label: "Name" },
            {
              key: "type", label: "Type",
              render: (r) => (
                <Chip tone={r.type === "csr_activity" ? "green" : "amber"}>
                  {r.type === "csr_activity" ? "CSR Activity" : "Challenge"}
                </Chip>
              ),
            },
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
          empty="No categories yet — add the first one to get started."
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Category" : "Add Category"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Name</label>
            <Input
              required placeholder="e.g. Tree Planting"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Type</label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType })}
              className="w-full"
            >
              {CATEGORY_TYPES.map((t) => (
                <option key={t} value={t}>{t === "csr_activity" ? "CSR Activity" : "Challenge"}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
            </Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
