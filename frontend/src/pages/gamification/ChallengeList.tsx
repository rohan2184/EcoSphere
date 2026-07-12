/**
 * Challenges — list, status transitions (admin), join/update progress (employee),
 * approve/reject participations (admin).
 */

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useFakeRole } from "../../lib/fakeAuth";
import { Button, Chip, Dialog, Input, Select, Slider, Toast } from "../../components/ui";

/* ── Types ──────────────────────────────────────────────────────────── */

interface Challenge {
  id: number;
  title: string;
  category_id: number | null;
  description: string | null;
  xp: number;
  difficulty: string | null;
  evidence_required: boolean;
  deadline: string | null;
  status: string;
  created_at: string;
}

interface ChallengeParticipation {
  id: number;
  challenge_id: number;
  user_id: number;
  progress: number;
  proof_file: string | null;
  approval_status: string;
  xp_awarded: number;
  created_at: string;
}

const ALL_STATUSES = ["draft", "active", "under_review", "completed", "archived"] as const;

function statusTone(s: string): "green" | "amber" | "red" | "neutral" {
  if (s === "active") return "green";
  if (s === "draft" || s === "under_review") return "amber";
  if (s === "archived") return "red";
  return "neutral";
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function ChallengeList() {
  const [role] = useFakeRole();
  const isAdmin = role === "admin";

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tone: "green" | "red" } | null>(null);

  /* Join modal (employee) */
  const [joinChallenge, setJoinChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState(0);
  const [proofFile, setProofFile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Admin: expanded challenge for reviewing participations */
  const [reviewChallengeId, setReviewChallengeId] = useState<number | null>(null);
  const [participations, setParticipations] = useState<ChallengeParticipation[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  /* ── Fetch challenges ──────────────────────────────────────── */

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Challenge[]>("/gamification/challenges");
      setChallenges(data);
    } catch (err) {
      setToast({ msg: errorMessage(err), tone: "red" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  /* ── Status transition (admin) ─────────────────────────────── */

  async function handleStatusChange(challengeId: number, newStatus: string, previousStatus: string) {
    try {
      await api.patch(`/gamification/challenges/${challengeId}/status`, {
        new_status: newStatus,
      });
      setChallenges((prev) =>
        prev.map((c) => (c.id === challengeId ? { ...c, status: newStatus } : c)),
      );
      setToast({ msg: `Status changed to ${newStatus}`, tone: "green" });
    } catch (err) {
      // Revert dropdown visually
      setChallenges((prev) =>
        prev.map((c) => (c.id === challengeId ? { ...c, status: previousStatus } : c)),
      );
      setToast({ msg: errorMessage(err), tone: "red" });
    }
  }

  /* ── Fetch participations (admin) ──────────────────────────── */

  async function fetchParticipations(challengeId: number) {
    setLoadingParts(true);
    try {
      // NOTE: the backend may not have a filter param for challenge_id —
      // fetch all and filter client-side.
      // TODO: ask backend team to add ?challenge_id= query param.
      const { data } = await api.get<ChallengeParticipation[]>(
        "/gamification/challenge-participations",
      );
      setParticipations(
        data.filter(
          (p) => p.challenge_id === challengeId && p.approval_status === "pending",
        ),
      );
    } catch (err) {
      setToast({ msg: errorMessage(err), tone: "red" });
    } finally {
      setLoadingParts(false);
    }
  }

  /* ── Join challenge (employee) ─────────────────────────────── */

  async function handleJoin() {
    if (!joinChallenge) return;
    setSubmitting(true);
    try {
      await api.post("/gamification/challenge-participations", {
        challenge_id: joinChallenge.id,
        progress,
      });
      setToast({ msg: "Joined challenge!", tone: "green" });
      setJoinChallenge(null);
      setProgress(0);
      setProofFile("");
    } catch (err) {
      setToast({ msg: errorMessage(err), tone: "red" });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Approve / Reject participation (admin) ────────────────── */

  async function handleDecision(participationId: number, decision: "approved" | "rejected") {
    try {
      await api.patch(`/gamification/challenge-participations/${participationId}/approve`, {
        approval_status: decision,
      });
      setToast({ msg: `Participation ${decision}`, tone: decision === "approved" ? "green" : "red" });
      if (reviewChallengeId !== null) fetchParticipations(reviewChallengeId);
    } catch (err) {
      setToast({ msg: errorMessage(err), tone: "red" });
    }
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Challenges</h1>
        <p className="text-sm text-stone-500 mt-1">Gamification challenges for employees</p>
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : challenges.length === 0 ? (
        <p className="text-sm text-stone-400">No challenges found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((ch) => (
            <div
              key={ch.id}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-stone-800 leading-snug">{ch.title}</h3>
                <Chip tone={statusTone(ch.status)}>{ch.status}</Chip>
              </div>

              {ch.description && (
                <p className="text-sm text-stone-500 mb-3 line-clamp-2">{ch.description}</p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-stone-400 mb-4">
                {ch.difficulty && <span>⚡ {ch.difficulty}</span>}
                {ch.deadline && <span>⏰ {ch.deadline}</span>}
                <span className="font-medium text-emerald-700">{ch.xp} XP</span>
                {ch.evidence_required && (
                  <span className="text-amber-600 font-medium">📎 Evidence required</span>
                )}
              </div>

              {/* Admin: status dropdown */}
              {isAdmin && (
                <div className="mb-3">
                  <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">
                    Status
                  </label>
                  <Select
                    className="w-full text-xs"
                    value={ch.status}
                    onChange={(e) => handleStatusChange(ch.id, e.target.value, ch.status)}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Employee: Join / Update button */}
              {!isAdmin && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setJoinChallenge(ch);
                    setProgress(0);
                    setProofFile("");
                  }}
                >
                  Join / Update Progress
                </Button>
              )}

              {/* Admin: Review participations */}
              {isAdmin && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const expanding = reviewChallengeId !== ch.id;
                      setReviewChallengeId(expanding ? ch.id : null);
                      if (expanding) fetchParticipations(ch.id);
                    }}
                  >
                    {reviewChallengeId === ch.id ? "Hide Participations" : "Review Participations"}
                  </Button>

                  {reviewChallengeId === ch.id && (
                    <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
                      {loadingParts ? (
                        <p className="text-xs text-stone-400">Loading…</p>
                      ) : participations.length === 0 ? (
                        <p className="text-xs text-stone-400">No pending participations.</p>
                      ) : (
                        participations.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2"
                          >
                            <div className="min-w-0 text-xs">
                              <span className="font-medium text-stone-700">User #{p.user_id}</span>
                              <span className="ml-2 text-stone-400">Progress: {p.progress}%</span>
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Join Modal (employee) ──────────────────────────────── */}
      <Dialog
        open={!!joinChallenge}
        onClose={() => setJoinChallenge(null)}
        title={`Join: ${joinChallenge?.title ?? ""}`}
      >
        <div className="space-y-4">
          <Slider value={progress} onChange={setProgress} label="Progress" />
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Proof file (optional)
            </label>
            <Input
              placeholder="e.g. /uploads/proof.pdf or https://..."
              className="w-full"
              value={proofFile}
              onChange={(e) => setProofFile(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setJoinChallenge(null)}>
              Cancel
            </Button>
            <Button onClick={handleJoin} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
