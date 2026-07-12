import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Input, Select } from "../../components/ui";

const SOURCE_TYPES = ["purchase", "manufacturing", "expense", "fleet"] as const;

interface EmissionFactor extends Record<string, unknown> {
  id: number;
  name: string;
  source_type: string;
  unit: string;
  factor_value: number;
  status: string | null;
}

const EMPTY = { name: "", source_type: "purchase", unit: "kg", factor_value: "", status: "active" };

export default function EmissionFactors() {
  const [rows, setRows] = useState<EmissionFactor[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get<EmissionFactor[]>("/env/emission-factors")
      .then((r) => setRows(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name,
      source_type: form.source_type,
      unit: form.unit,
      factor_value: Number(form.factor_value),
      status: form.status || null,
    };
    try {
      if (editingId === null) await api.post("/env/emission-factors", payload);
      else await api.put(`/env/emission-factors/${editingId}`, payload);
      reset();
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function edit(r: EmissionFactor) {
    setEditingId(r.id);
    setForm({
      name: r.name, source_type: r.source_type, unit: r.unit,
      factor_value: String(r.factor_value), status: r.status ?? "active",
    });
  }

  async function remove(id: number) {
    if (!confirm("Delete this emission factor?")) return;
    try {
      await api.delete(`/env/emission-factors/${id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">Emission Factors</h1>
      <p className="text-sm text-stone-500">kg CO₂e emitted per unit, by source type.</p>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-48" />
        <Select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
          {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input required placeholder="Unit (kg, liter…)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-32" />
        <Input required type="number" step="any" placeholder="Factor value" value={form.factor_value} onChange={(e) => setForm({ ...form, factor_value: e.target.value })} className="w-32" />
        <Button type="submit">{editingId === null ? "Add factor" : "Save changes"}</Button>
        {editingId !== null && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable<EmissionFactor>
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "source_type", label: "Source", render: (r) => <Chip tone="green">{r.source_type}</Chip> },
          { key: "unit", label: "Unit" },
          { key: "factor_value", label: "kg CO₂e / unit" },
          {
            key: "actions", label: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => edit(r)}>Edit</Button>
                <Button variant="danger" onClick={() => remove(r.id)}>Delete</Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        empty="No emission factors yet — add the first one above."
      />
    </div>
  );
}
