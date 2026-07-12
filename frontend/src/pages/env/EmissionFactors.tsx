import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

const SOURCE_TYPES = ["purchase", "manufacturing", "expense", "fleet"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

interface EmissionFactor extends Record<string, unknown> {
  id: number;
  name: string;
  source_type: SourceType;
  unit: string;
  factor_value: number;
  status: string | null;
}

interface FormState {
  name: string;
  source_type: SourceType;
  unit: string;
  factor_value: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  source_type: "purchase",
  unit: "",
  factor_value: "",
  status: "active",
};

export default function EmissionFactors() {
  const [rows, setRows] = useState<EmissionFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmissionFactor | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<EmissionFactor[]>("/env/emission-factors")
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

  function openEdit(row: EmissionFactor) {
    setEditing(row);
    setForm({
      name: row.name,
      source_type: row.source_type,
      unit: row.unit,
      factor_value: String(row.factor_value),
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
        source_type: form.source_type,
        unit: form.unit,
        factor_value: Number(form.factor_value),
        status: form.status || null,
      };
      if (editing) {
        await api.put(`/env/emission-factors/${editing.id}`, payload);
        setToast({ message: "Emission factor updated.", tone: "green" });
      } else {
        await api.post("/env/emission-factors", payload);
        setToast({ message: "Emission factor added.", tone: "green" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: EmissionFactor) {
    if (!confirm(`Delete emission factor "${row.name}"?`)) return;
    try {
      await api.delete(`/env/emission-factors/${row.id}`);
      setToast({ message: "Emission factor deleted.", tone: "green" });
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Emission Factors</h1>
          <p className="text-sm text-stone-500">CO₂e conversion factors used to calculate carbon transactions.</p>
        </div>
        <Button onClick={openAdd}>+ Add Emission Factor</Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading emission factors…
        </div>
      ) : (
        <DataTable<EmissionFactor>
          columns={[
            { key: "name", label: "Name" },
            {
              key: "source_type",
              label: "Source Type",
              render: (r) => <Chip>{r.source_type}</Chip>,
            },
            { key: "unit", label: "Unit" },
            {
              key: "factor_value",
              label: "Factor (kg CO₂e/unit)",
              render: (r) => <span className="tabular-nums">{r.factor_value}</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Chip tone={r.status === "active" ? "green" : "neutral"}>{r.status ?? "—"}</Chip>,
            },
            {
              key: "actions",
              label: "",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                  <Button variant="danger" onClick={() => remove(r)}>Delete</Button>
                </div>
              ),
            },
          ]}
          rows={rows}
          empty="No emission factors yet — add the first one to get started."
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Emission Factor" : "Add Emission Factor"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Name</label>
            <Input
              required
              placeholder="e.g. Diesel fuel"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Source Type</label>
            <Select
              value={form.source_type}
              onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}
              className="w-full"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Unit</label>
              <Input
                required
                placeholder="e.g. liter"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Factor Value</label>
              <Input
                required
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 2.68"
                value={form.factor_value}
                onChange={(e) => setForm({ ...form, factor_value: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Status</label>
            <Input
              placeholder="e.g. active"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add factor"}
            </Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
