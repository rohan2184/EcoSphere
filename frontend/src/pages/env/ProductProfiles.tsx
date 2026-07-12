import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

interface Product extends Record<string, unknown> {
  id: number;
  product_name: string;
  category: string | null;
  default_emission_factor_id: number | null;
  notes: string | null;
}

interface EmissionFactor {
  id: number;
  name: string;
  unit: string;
  factor_value: number;
}

interface FormState {
  product_name: string;
  category: string;
  default_emission_factor_id: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  product_name: "",
  category: "",
  default_emission_factor_id: "",
  notes: "",
};

export default function ProductProfiles() {
  const [rows, setRows] = useState<Product[]>([]);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<Product[]>("/env/products"),
      api.get<EmissionFactor[]>("/env/emission-factors").catch(() => ({ data: [] as EmissionFactor[] })),
    ])
      .then(([prodRes, efRes]) => {
        setRows(prodRes.data);
        setFactors(efRes.data);
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

  function openEdit(row: Product) {
    setEditing(row);
    setForm({
      product_name: row.product_name,
      category: row.category ?? "",
      default_emission_factor_id: row.default_emission_factor_id != null ? String(row.default_emission_factor_id) : "",
      notes: row.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        product_name: form.product_name,
        category: form.category || null,
        default_emission_factor_id: form.default_emission_factor_id ? Number(form.default_emission_factor_id) : null,
        notes: form.notes || null,
      };
      if (editing) {
        await api.put(`/env/products/${editing.id}`, payload);
        setToast({ message: "Product profile updated.", tone: "green" });
      } else {
        await api.post("/env/products", payload);
        setToast({ message: "Product profile created.", tone: "green" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Product) {
    if (!confirm(`Delete product "${row.product_name}"?`)) return;
    try {
      await api.delete(`/env/products/${row.id}`);
      setToast({ message: "Product profile deleted.", tone: "green" });
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    }
  }

  const factorName = (id: number | null) => {
    if (id == null) return "—";
    const ef = factors.find((f) => f.id === id);
    return ef ? `${ef.name} (${ef.factor_value} ${ef.unit})` : `Factor #${id}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Product ESG Profiles</h1>
          <p className="text-sm text-stone-500">Manage product-level ESG profiles and default emission factors.</p>
        </div>
        <Button onClick={openAdd}>+ Add Product Profile</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading product profiles…
        </div>
      ) : (
        <DataTable<Product>
          columns={[
            { key: "product_name", label: "Product Name" },
            {
              key: "category", label: "Category",
              render: (r) => r.category ? <Chip>{r.category}</Chip> : <>—</>,
            },
            {
              key: "default_emission_factor_id", label: "Default Emission Factor",
              render: (r) => <span className="text-xs">{factorName(r.default_emission_factor_id)}</span>,
            },
            {
              key: "notes", label: "Notes",
              render: (r) => (
                <span className="text-xs text-stone-500 line-clamp-2">{r.notes ?? "—"}</span>
              ),
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
          empty="No product profiles yet — add the first one to get started."
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Product Profile" : "Add Product Profile"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Product Name</label>
            <Input
              required placeholder="e.g. EcoWidget"
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Category</label>
            <Input
              placeholder="e.g. hardware, packaging"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Default Emission Factor</label>
            <Select
              value={form.default_emission_factor_id}
              onChange={(e) => setForm({ ...form, default_emission_factor_id: e.target.value })}
              className="w-full"
            >
              <option value="">None</option>
              {factors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.factor_value} kg CO₂e/{f.unit}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Notes</label>
            <textarea
              placeholder="ESG notes for this product…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
