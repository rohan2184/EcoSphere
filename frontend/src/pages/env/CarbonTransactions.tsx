import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Input, Select } from "../../components/ui";

interface Department { id: number; name: string }
interface Factor { id: number; name: string; source_type: string; factor_value: number; unit: string }
interface Txn extends Record<string, unknown> {
  id: number;
  department_id: number;
  source_type: string;
  quantity: number;
  emission_factor_id: number;
  co2e_amount: number;
  date: string;
  auto_generated: boolean;
}

const EMPTY = { department_id: "", emission_factor_id: "", quantity: "", co2e_amount: "", date: "" };

export default function CarbonTransactions() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [autoCalc, setAutoCalc] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  const load = useCallback(() => {
    api.get<Txn[]>("/env/carbon-transactions").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    load();
    api.get<Department[]>("/departments").then((r) => setDepts(r.data)).catch(() => {});
    api.get<Factor[]>("/env/emission-factors").then((r) => setFactors(r.data)).catch(() => {});
    api.get<{ auto_emission_calc: boolean }>("/settings")
      .then((r) => setAutoCalc(r.data.auto_emission_calc))
      .catch(() => {});
  }, [load]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const factorById = useMemo(() => new Map(factors.map((f) => [f.id, f])), [factors]);

  const selectedFactor = form.emission_factor_id ? factorById.get(Number(form.emission_factor_id)) : undefined;
  const computedCo2e = selectedFactor && form.quantity
    ? Number(form.quantity) * selectedFactor.factor_value
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedFactor) return setError("Pick an emission factor.");
    const payload = {
      department_id: Number(form.department_id),
      source_type: selectedFactor.source_type,
      emission_factor_id: selectedFactor.id,
      quantity: Number(form.quantity),
      date: form.date,
      // When auto-calc is on the server recomputes and ignores this; send null.
      co2e_amount: autoCalc ? null : Number(form.co2e_amount),
    };
    try {
      await api.post("/env/carbon-transactions", payload);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.delete(`/env/carbon-transactions/${id}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-stone-800">Carbon Transactions</h1>
        <Chip tone={autoCalc ? "green" : "amber"}>
          auto-calc {autoCalc ? "ON" : "OFF"}
        </Chip>
      </div>
      <p className="text-sm text-stone-500">
        {autoCalc
          ? "CO₂e is computed server-side as quantity × factor."
          : "Auto-calc is off — enter CO₂e manually (toggle it in Settings)."}
      </p>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Select required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
          <option value="">Department…</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select required value={form.emission_factor_id} onChange={(e) => setForm({ ...form, emission_factor_id: e.target.value })}>
          <option value="">Emission factor…</option>
          {factors.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.source_type})</option>)}
        </Select>
        <Input required type="number" step="any" placeholder={`Quantity${selectedFactor ? " (" + selectedFactor.unit + ")" : ""}`}
          value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-36" />
        {autoCalc ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
            CO₂e ≈ <span className="font-semibold">{computedCo2e !== null ? computedCo2e.toFixed(2) : "—"}</span> kg
          </div>
        ) : (
          <Input required type="number" step="any" placeholder="CO₂e (kg)"
            value={form.co2e_amount} onChange={(e) => setForm({ ...form, co2e_amount: e.target.value })} className="w-32" />
        )}
        <Input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Button type="submit">Add transaction</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable<Txn>
        columns={[
          { key: "id", label: "ID" },
          { key: "date", label: "Date" },
          { key: "department_id", label: "Department", render: (r) => deptName.get(r.department_id) ?? r.department_id },
          { key: "source_type", label: "Source" },
          { key: "quantity", label: "Qty" },
          { key: "emission_factor_id", label: "Factor", render: (r) => factorById.get(r.emission_factor_id)?.name ?? r.emission_factor_id },
          { key: "co2e_amount", label: "CO₂e (kg)", render: (r) => <span className="font-medium text-emerald-800">{r.co2e_amount}</span> },
          { key: "auto_generated", label: "Auto", render: (r) => r.auto_generated ? <Chip tone="green">auto</Chip> : <Chip>manual</Chip> },
          { key: "actions", label: "", render: (r) => <Button variant="danger" onClick={() => remove(r.id)}>Delete</Button> },
        ]}
        rows={rows}
        empty="No transactions yet — add one above."
      />
    </div>
  );
}
