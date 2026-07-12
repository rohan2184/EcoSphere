import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Chip, Dialog, Input, Select, Slider } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/ToastProvider";

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
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  /* Join modal (employee) */
  const [joinChallenge, setJoinChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState(0);
  const [proofFile, setProofFile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Admin: expanded challenge for reviewing participations */
  const [reviewChallengeId, setReviewChallengeId] = useState<number | null>(null);
  const [participations, setParticipations] = useState<ChallengeParticipation[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  /* Admin: create challenge dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", description: "", xp: "50", difficulty: "easy",
    evidence_required: false, deadline: "",
  });
  const [createSaving, setCreateSaving] = useState(false);

  /* ── Fetch challenges ──────────────────────────────────────── */

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Challenge[]>("/gamification/challenges");
      setChallenges(data);
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      showToast(`Challenge status changed to ${newStatus} successfully!`, "green");
    } catch (err) {
      // Revert dropdown visually
      setChallenges((prev) =>
        prev.map((c) => (c.id === challengeId ? { ...c, status: previousStatus } : c)),
      );
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Delete challenge (admin) ──────────────────────────────── */

  async function handleDeleteChallenge(challengeId: number, title: string) {
    if (!window.confirm(`Delete challenge "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/gamification/challenges/${challengeId}`);
      showToast("Challenge deleted successfully!", "green");
      fetchChallenges();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Fetch participations (admin) ──────────────────────────── */

  async function fetchParticipations(challengeId: number) {
    setLoadingParts(true);
    try {
      const { data } = await api.get<ChallengeParticipation[]>(
        "/gamification/challenge-participations",
      );
      setParticipations(
        data.filter(
          (p) => p.challenge_id === challengeId && p.approval_status === "pending",
        ),
      );
    } catch (err) {
      showToast(errorMessage(err), "red");
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
      showToast("Joined and updated progress successfully!", "green");
      setJoinChallenge(null);
      setProgress(0);
      setProofFile("");
    } catch (err) {
      showToast(errorMessage(err), "red");
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
      showToast(`Participation ${decision} successfully!`, "green");
      if (reviewChallengeId !== null) fetchParticipations(reviewChallengeId);
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Admin: create challenge ────────────────────────────────── */

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateSaving(true);
    try {
      await api.post("/gamification/challenges", {
        title: createForm.title,
        description: createForm.description || null,
        xp: Number(createForm.xp),
        difficulty: createForm.difficulty || null,
        evidence_required: createForm.evidence_required,
        deadline: createForm.deadline || null,
      });
      showToast("Challenge created successfully!", "green");
      setCreateOpen(false);
      setCreateForm({ title: "", description: "", xp: "50", difficulty: "easy", evidence_required: false, deadline: "" });
      fetchChallenges();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDelete(challengeId: number) {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    try {
      await api.delete(`/gamification/challenges/${challengeId}`);
      showToast("Challenge deleted.", "green");
      fetchChallenges();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Challenges</h1>
          <p className="text-sm text-stone-500 mt-1">Gamification challenges for employees</p>
        </div>
        {isAdmin && <Button onClick={() => setCreateOpen(true)}>+ Create Challenge</Button>}
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : challenges.length === 0 ? (
        <EmptyState
          icon="🏆"
          title={isAdmin ? "No Challenges Yet" : "No Challenges Available"}
          description={
            isAdmin
              ? "Create a new challenge to get employees started on their eco journey."
              : "There are currently no active challenges for you to join. Check back later!"
          }
        />
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

              {/* Admin: Review participations + Delete */}
              {isAdmin && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const expanding = reviewChallengeId !== ch.id;
                        setReviewChallengeId(expanding ? ch.id : null);
                        if (expanding) fetchParticipations(ch.id);
                      }}
                    >
                      {reviewChallengeId === ch.id ? "Hide" : "Review"}
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(ch.id)}>
                      Delete
                    </Button>
                  </div>

                  {reviewChallengeId === ch.id && (
                    <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
                      {loadingParts ? (
                        <p className="text-xs text-stone-400">Loading…</p>
                      ) : participations.length === 0 ? (
                        <EmptyState
                          icon="📋"
                          title="No Pending Submissions"
                          description="No employees have pending submissions for review for this challenge."
                        />
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
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => handleDeleteChallenge(ch.id, ch.title)}
                  >
                    Delete Challenge
                  </Button>
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

      {/* ── Create Challenge Dialog (admin) ──────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Challenge"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Title</label>
            <Input
              required
              placeholder="e.g. Zero-Waste Week"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Description</label>
            <Input
              placeholder="Challenge description"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">XP Reward</label>
              <Input
                required
                type="number"
                min="1"
                value={createForm.xp}
                onChange={(e) => setCreateForm({ ...createForm, xp: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Difficulty</label>
              <Select
                value={createForm.difficulty}
                onChange={(e) => setCreateForm({ ...createForm, difficulty: e.target.value })}
                className="w-full"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Deadline</label>
              <Input
                type="date"
                value={createForm.deadline}
                onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 flex items-end">
              <label className="flex items-center gap-2 text-sm text-stone-700 py-1.5">
                <input
                  type="checkbox"
                  checked={createForm.evidence_required}
                  onChange={(e) => setCreateForm({ ...createForm, evidence_required: e.target.checked })}
                  className="accent-emerald-600"
                />
                Evidence Required
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createSaving}>
              {createSaving ? "Creating…" : "Create Challenge"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
