import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Input } from "../../components/ui";

interface Policy extends Record<string, unknown> {
  id: number;
  title: string;
  category: string | null;
  version: string | null;
  effective_date: string | null;
  status: string | null;
}

export default function Policies() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", category: "", version: "1.0", effective_date: "" });

  const load = useCallback(() => {
    api.get<Policy[]>("/governance/policies").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/governance/policies", {
        ...form,
        category: form.category || null,
        effective_date: form.effective_date || null,
      });
      setForm({ title: "", category: "", version: "1.0", effective_date: "" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function acknowledge(policyId: number) {
    setError("");
    try {
      // backend derives the user from the JWT
      await api.post(`/governance/policies/${policyId}/acknowledge`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(policyId: number) {
    if (!confirm("Delete this policy (and its acknowledgements)?")) return;
    try {
      await api.delete(`/governance/policies/${policyId}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">ESG Policies</h1>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <Input required placeholder="Policy title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-56" />
        <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-36" />
        <Input placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-24" />
        <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
        <Button type="submit">Add policy</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable<Policy>
        columns={[
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "category", label: "Category" },
          { key: "version", label: "Version" },
          { key: "effective_date", label: "Effective" },
          { key: "status", label: "Status", render: (r) => <Chip tone={r.status === "active" ? "green" : "neutral"}>{r.status}</Chip> },
          {
            key: "actions", label: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => acknowledge(r.id)}>Acknowledge</Button>
                <Button variant="danger" onClick={() => remove(r.id)}>Delete</Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        empty="No policies yet — add the first one above."
      />
    </div>
  );
}
