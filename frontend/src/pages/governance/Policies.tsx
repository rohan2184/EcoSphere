import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input } from "../../components/ui";

interface Policy extends Record<string, unknown> {
  id: number;
  title: string;
  category: string | null;
  version: string | null;
  effective_date: string | null;
  status: string | null;
}

interface Acknowledgement {
  id: number;
  policy_id: number;
  user_id: number;
  acknowledged_at: string | null;
}

interface UserLite { id: number; name: string }

export default function Policies() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", category: "", version: "1.0", effective_date: "" });

  // Acknowledgements view state.
  const [ackPolicy, setAckPolicy] = useState<Policy | null>(null);
  const [acks, setAcks] = useState<Acknowledgement[]>([]);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState("");
  // id → name map, resolved from /users when the caller is allowed (admin). Falls back to id.
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get<Policy[]>("/governance/policies").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  // Best-effort user directory — non-admins get 403; we degrade to showing user IDs.
  useEffect(() => {
    api.get<UserLite[]>("/users")
      .then((r) => {
        setUserMap(Object.fromEntries(r.data.map((u) => [u.id, u.name])));
        setTotalUsers(r.data.length);
      })
      .catch(() => {
        setUserMap({});
        setTotalUsers(null);
      });
  }, []);

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

  async function openAcks(policy: Policy) {
    setAckPolicy(policy);
    setAcks([]);
    setAckError("");
    setAckLoading(true);
    try {
      const { data } = await api.get<Acknowledgement[]>(`/governance/policies/${policy.id}/acknowledgements`);
      setAcks(data);
    } catch (err) {
      setAckError(errorMessage(err));
    } finally {
      setAckLoading(false);
    }
  }

  const ackRate = totalUsers && totalUsers > 0 ? Math.round((acks.length / totalUsers) * 100) : null;

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
                <Button variant="ghost" onClick={() => openAcks(r)}>Acknowledgements</Button>
                <Button variant="outline" onClick={() => acknowledge(r.id)}>Acknowledge</Button>
                <Button variant="danger" onClick={() => remove(r.id)}>Delete</Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        empty="No policies yet — add the first one above."
      />

      <Dialog
        open={ackPolicy !== null}
        onClose={() => setAckPolicy(null)}
        title={ackPolicy ? `Acknowledgements — ${ackPolicy.title}` : "Acknowledgements"}
      >
        {ackLoading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : ackError ? (
          <p className="text-sm text-red-600">{ackError}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 text-sm text-stone-600">
              <Chip tone="green">{acks.length} acknowledged</Chip>
              {ackRate !== null && <Chip tone={ackRate >= 100 ? "green" : "amber"}>{ackRate}% of {totalUsers}</Chip>}
            </div>
            {acks.length === 0 ? (
              <p className="text-sm text-stone-400">No one has acknowledged this policy yet.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto text-sm">
                {acks.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-stone-700">{userMap[a.user_id] ?? `User #${a.user_id}`}</span>
                    <span className="text-xs text-stone-400">
                      {a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleString() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => setAckPolicy(null)}>Close</Button>
        </div>
      </Dialog>
    </div>
  );
}
