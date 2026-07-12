import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Dialog, Input } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/ToastProvider";

/* ── Types ──────────────────────────────────────────────────────────── */

interface Badge {
  id: number;
  name: string;
  description: string | null;
  unlock_rule: any;
  icon: string | null;
}

interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  awarded_at: string;
  badge_name: string | null;
}

interface Reward {
  id: number;
  name: string;
  description: string | null;
  points_required: number;
  stock: number;
  status: string | null;
}

interface BadgeForm {
  name: string;
  description: string;
  icon: string;
  unlock_rule: string;
}

interface RewardForm {
  name: string;
  description: string;
  points_required: string;
  stock: string;
}

const EMPTY_BADGE_FORM: BadgeForm = { name: "", description: "", icon: "🎖", unlock_rule: "{}" };
const EMPTY_REWARD_FORM: RewardForm = { name: "", description: "", points_required: "", stock: "" };

/* ── Component ─────────────────────────────────────────────────────── */

export default function BadgesAndRewards() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";

  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);

  // Badge dialog
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [badgeForm, setBadgeForm] = useState<BadgeForm>(EMPTY_BADGE_FORM);
  const [savingBadge, setSavingBadge] = useState(false);

  // Reward dialog
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [rewardForm, setRewardForm] = useState<RewardForm>(EMPTY_REWARD_FORM);
  const [savingReward, setSavingReward] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [badgesRes, rewardsRes] = await Promise.all([
        api.get<Badge[]>("/gamification/badges"),
        api.get<Reward[]>("/gamification/rewards?include_out_of_stock=true"),
      ]);
      setAllBadges(badgesRes.data);
      setRewards(rewardsRes.data);

      // If user is loaded, fetch their earned badges
      if (user) {
        const myBadgesRes = await api.get<UserBadge[]>(`/gamification/users/${user.id}/badges`);
        setMyBadges(myBadgesRes.data);
      }
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Redeem Reward ─────────────────────────────────────────── */

  async function handleRedeem(reward: Reward) {
    setRedeeming(reward.id);
    try {
      await api.post(`/gamification/rewards/${reward.id}/redeem`);
      showToast(`Successfully redeemed ${reward.name} for ${reward.points_required} points!`, "green");

      // Update local stock to avoid full refetch
      setRewards((prev) =>
        prev.map((r) => r.id === reward.id ? { ...r, stock: Math.max(0, r.stock - 1) } : r)
      );
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setRedeeming(null);
    }
  }

  /* ── Badge CRUD (admin) ────────────────────────────────────── */

  function openBadgeCreate() {
    setEditingBadge(null);
    setBadgeForm(EMPTY_BADGE_FORM);
    setBadgeDialogOpen(true);
  }

  function openBadgeEdit(badge: Badge) {
    setEditingBadge(badge);
    setBadgeForm({
      name: badge.name,
      description: badge.description ?? "",
      icon: badge.icon ?? "🎖",
      unlock_rule: badge.unlock_rule ? JSON.stringify(badge.unlock_rule) : "{}",
    });
    setBadgeDialogOpen(true);
  }

  async function submitBadge(e: React.FormEvent) {
    e.preventDefault();
    setSavingBadge(true);
    try {
      let parsedRule: any = {};
      try {
        parsedRule = JSON.parse(badgeForm.unlock_rule);
      } catch {
        showToast("Unlock rule must be valid JSON.", "red");
        setSavingBadge(false);
        return;
      }
      const payload = {
        name: badgeForm.name,
        description: badgeForm.description || null,
        icon: badgeForm.icon || null,
        unlock_rule: parsedRule,
      };
      if (editingBadge) {
        await api.put(`/gamification/badges/${editingBadge.id}`, payload);
        showToast("Badge updated.", "green");
      } else {
        await api.post("/gamification/badges", payload);
        showToast("Badge created.", "green");
      }
      setBadgeDialogOpen(false);
      fetchData();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSavingBadge(false);
    }
  }

  async function deleteBadge(badge: Badge) {
    if (!window.confirm(`Delete badge "${badge.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/gamification/badges/${badge.id}`);
      showToast("Badge deleted.", "green");
      fetchData();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Reward CRUD (admin) ───────────────────────────────────── */

  function openRewardEdit(reward: Reward) {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description ?? "",
      points_required: String(reward.points_required),
      stock: String(reward.stock),
    });
    setRewardDialogOpen(true);
  }

  async function submitReward(e: React.FormEvent) {
    e.preventDefault();
    setSavingReward(true);
    try {
      const payload = {
        name: rewardForm.name,
        description: rewardForm.description || null,
        points_required: Number(rewardForm.points_required),
        stock: Number(rewardForm.stock),
      };
      if (editingReward) {
        await api.put(`/gamification/rewards/${editingReward.id}`, payload);
        showToast("Reward updated.", "green");
      }
      setRewardDialogOpen(false);
      fetchData();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSavingReward(false);
    }
  }

  async function deleteReward(reward: Reward) {
    if (!window.confirm(`Delete reward "${reward.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/gamification/rewards/${reward.id}`);
      showToast("Reward deleted.", "green");
      fetchData();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  /* ── Derived state ────────────────────────────────────────── */

  const myBadgeIds = new Set(myBadges.map((b) => b.badge_id));

  return (
    <div className="space-y-10">
      {/* ── Badges Section ──────────────────────────────────────── */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Badges</h2>
            <p className="text-sm text-stone-500 mt-1">Earn badges by participating in CSR activities and challenges.</p>
          </div>
          {isAdmin && (
            <Button onClick={openBadgeCreate}>+ Create Badge</Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : allBadges.length === 0 ? (
          <EmptyState
            icon="🎖"
            title="No Badges Available"
            description="There are currently no badges defined for eco-milestones."
            actionLabel={isAdmin ? "+ Create Badge" : undefined}
            onAction={isAdmin ? openBadgeCreate : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {allBadges.map((badge) => {
              const earned = myBadgeIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border text-center transition-all ${earned
                      ? "border-emerald-200 bg-emerald-50 shadow-sm"
                      : "border-stone-200 bg-white opacity-60 grayscale hover:grayscale-0"
                    }`}
                >
                  <div className="text-4xl mb-3">{badge.icon || "🎖"}</div>
                  <h3 className={`font-bold leading-tight ${earned ? "text-emerald-900" : "text-stone-700"}`}>
                    {badge.name}
                  </h3>
                  {badge.description && (
                    <p className="text-xs text-stone-500 mt-2 line-clamp-2">{badge.description}</p>
                  )}
                  {earned && (
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                      Earned
                    </div>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" className="text-xs px-2 py-1" onClick={() => openBadgeEdit(badge)}>
                        Edit
                      </Button>
                      <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteBadge(badge)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Rewards Section ─────────────────────────────────────── */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Rewards</h2>
            <p className="text-sm text-stone-500 mt-1">Redeem your hard-earned points for exclusive rewards.</p>
          </div>
          {user && (
            <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-semibold border border-emerald-200 shadow-sm">
              My Points: {user.points_balance ?? 0}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : rewards.length === 0 ? (
          <EmptyState
            icon="🎁"
            title="No Rewards Available"
            description="There are currently no items in the reward store."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-800 leading-snug mb-2">{reward.name}</h3>
                  {reward.description && (
                    <p className="text-sm text-stone-500 mb-4 line-clamp-3">{reward.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-4 mt-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-emerald-700">{reward.points_required} pts</span>
                    <span className={`text-xs ${reward.stock > 0 ? "text-stone-400" : "text-red-500 font-medium"}`}>
                      {reward.stock > 0 ? `${reward.stock} left` : "Out of stock"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => handleRedeem(reward)}
                      disabled={reward.stock <= 0 || redeeming === reward.id}
                    >
                      {redeeming === reward.id ? "Redeeming…" : "Redeem"}
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="outline" className="text-xs px-2 py-1" onClick={() => openRewardEdit(reward)}>
                          Edit
                        </Button>
                        <Button variant="danger" className="text-xs px-2 py-1" onClick={() => deleteReward(reward)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Badge Create/Edit Dialog ───────────────────────────── */}
      <Dialog
        open={badgeDialogOpen}
        onClose={() => setBadgeDialogOpen(false)}
        title={editingBadge ? "Edit Badge" : "Create Badge"}
      >
        <form onSubmit={submitBadge} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Name</label>
            <Input
              required
              placeholder="e.g. Eco Champion"
              value={badgeForm.name}
              onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Description</label>
            <Input
              placeholder="Badge description"
              value={badgeForm.description}
              onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="w-24 space-y-1">
              <label className="text-xs font-medium text-stone-600">Icon</label>
              <Input
                placeholder="🎖"
                value={badgeForm.icon}
                onChange={(e) => setBadgeForm({ ...badgeForm, icon: e.target.value })}
                className="w-full text-center text-lg"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Unlock Rule (JSON)</label>
              <Input
                placeholder='{"min_xp": 100}'
                value={badgeForm.unlock_rule}
                onChange={(e) => setBadgeForm({ ...badgeForm, unlock_rule: e.target.value })}
                className="w-full font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setBadgeDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingBadge}>
              {savingBadge ? "Saving…" : editingBadge ? "Save changes" : "Create badge"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Reward Edit Dialog ─────────────────────────────────── */}
      <Dialog
        open={rewardDialogOpen}
        onClose={() => setRewardDialogOpen(false)}
        title="Edit Reward"
      >
        <form onSubmit={submitReward} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Name</label>
            <Input
              required
              placeholder="e.g. Coffee Voucher"
              value={rewardForm.name}
              onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Description</label>
            <Input
              placeholder="Reward description"
              value={rewardForm.description}
              onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Points Required</label>
              <Input
                required
                type="number"
                min="0"
                value={rewardForm.points_required}
                onChange={(e) => setRewardForm({ ...rewardForm, points_required: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Stock</label>
              <Input
                required
                type="number"
                min="0"
                value={rewardForm.stock}
                onChange={(e) => setRewardForm({ ...rewardForm, stock: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRewardDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingReward}>
              {savingReward ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
