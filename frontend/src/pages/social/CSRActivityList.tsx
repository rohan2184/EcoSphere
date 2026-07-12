import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Chip, Dialog, Input } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/ToastProvider";

/* ── Types ──────────────────────────────────────────────────────────── */

interface CSRActivity {
  id: number;
  title: string;
  category_id: number | null;
  description: string | null;
  date: string | null;
  location: string | null;
  points_value: number;
  status: string;
  created_at: string;
}

interface Participation {
  id: number;
  user_id: number;
  csr_activity_id: number;
  proof_file: string | null;
  approval_status: string;
  points_earned: number;
  completion_date: string | null;
  created_at: string;
}

/* ── Status chip helper ────────────────────────────────────────────── */

function statusTone(s: string): "green" | "amber" | "red" | "neutral" {
  if (s === "approved" || s === "active") return "green";
  if (s === "pending") return "amber";
  if (s === "rejected") return "red";
  return "neutral";
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function CSRActivityList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";

  const [activities, setActivities] = useState<CSRActivity[]>([]);
  const [loading, setLoading] = useState(true);

  /* Participate modal */
  const [participateFor, setParticipateFor] = useState<CSRActivity | null>(null);
  const [proofFile, setProofFile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Admin: expanded activity for reviewing participations */
  const [reviewActivityId, setReviewActivityId] = useState<number | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  /* ── Fetch activities ─────────────────────────────────────── */

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CSRActivity[]>("/social/csr-activities");
      setActivities(data);
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  /* ── Fetch pending participations for an activity (admin) ── */

  async function fetchParticipations(activityId: number) {
    setLoadingParts(true);
    try {
      const { data } = await api.get<Participation[]>("/social/participations");
      setParticipations(
        data.filter(
          (p) => p.csr_activity_id === activityId && p.approval_status === "pending",
        ),
      );
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setLoadingParts(false);
    }
  }

  /* ── Submit participation (employee) ───────────────────────── */

  async function handleSubmitParticipation() {
    if (!participateFor) return;
    setSubmitting(true);
    try {
      await api.post("/social/participations", {
        csr_activity_id: participateFor.id,
        proof_file: proofFile || undefined,
      });
      showToast("Participation submitted successfully!", "green");
      setParticipateFor(null);
      setProofFile("");
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Approve / Reject (admin) ──────────────────────────────── */

  async function handleDeleteActivity(activityId: number, title: string) {
    if (!window.confirm(`Delete CSR activity "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/social/csr-activities/${activityId}`);
      showToast("CSR activity deleted successfully!", "green");
      fetchActivities();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  async function handleDecision(participationId: number, decision: "approved" | "rejected") {
    try {
      await api.patch(`/social/participations/${participationId}/approve`, {
        approval_status: decision,
      });
      showToast(`Participation ${decision} successfully!`, "green");
      if (reviewActivityId !== null) fetchParticipations(reviewActivityId);
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">CSR Activities</h1>
          <p className="text-sm text-stone-500 mt-1">Corporate Social Responsibility initiatives</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : activities.length === 0 ? (
        <EmptyState
          icon="♻"
          title="No CSR Activities"
          description="There are currently no Corporate Social Responsibility activities listed."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-stone-800 leading-snug">{act.title}</h3>
                <Chip tone={statusTone(act.status)}>{act.status}</Chip>
              </div>

              {act.description && (
                <p className="text-sm text-stone-500 mb-3 line-clamp-2">{act.description}</p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-stone-400 mb-4">
                {act.location && <span>📍 {act.location}</span>}
                {act.date && <span>📅 {act.date}</span>}
                <span className="font-medium text-emerald-700">{act.points_value} pts</span>
              </div>

              {/* Employee: Participate button */}
              {!isAdmin && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setParticipateFor(act);
                    setProofFile("");
                  }}
                >
                  Participate
                </Button>
              )}

              {/* Admin: Review participations toggle */}
              {isAdmin && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const expanding = reviewActivityId !== act.id;
                      setReviewActivityId(expanding ? act.id : null);
                      if (expanding) fetchParticipations(act.id);
                    }}
                  >
                    {reviewActivityId === act.id ? "Hide Participations" : "Review Participations"}
                  </Button>

                  {reviewActivityId === act.id && (
                    <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
                      {loadingParts ? (
                        <p className="text-xs text-stone-400">Loading…</p>
                      ) : participations.length === 0 ? (
                        <EmptyState
                          icon="📋"
                          title="No Pending Participations"
                          description="No employees are currently pending review for this CSR activity."
                        />
                      ) : (
                        participations.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2"
                          >
                            <div className="min-w-0 text-xs">
                              <span className="font-medium text-stone-700">User #{p.user_id}</span>
                              {p.proof_file && (
                                <span className="block text-stone-400 truncate">📎 {p.proof_file}</span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="primary"
                                className="text-xs px-2 py-1"
                                onClick={() => handleDecision(p.id, "approved")}
                              >
                                ✓
                              </Button>
                              <Button
                                variant="danger"
                                className="text-xs px-2 py-1"
                                onClick={() => handleDecision(p.id, "rejected")}
                              >
                                ✗
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                </div>
                  )}
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => handleDeleteActivity(act.id, act.title)}
                  >
                    Delete Activity
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Participate Modal ──────────────────────────────────── */}
      <Dialog
        open={!!participateFor}
        onClose={() => setParticipateFor(null)}
        title={`Participate: ${participateFor?.title ?? ""}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Proof file (optional — file path or URL)
            </label>
            <Input
              placeholder="e.g. /uploads/proof.pdf or https://..."
              className="w-full"
              value={proofFile}
              onChange={(e) => setProofFile(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setParticipateFor(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitParticipation} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
