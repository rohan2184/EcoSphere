import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button } from "../../components/ui";
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

/* ── Component ─────────────────────────────────────────────────────── */

export default function BadgesAndRewards() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);

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

  const myBadgeIds = new Set(myBadges.map((b) => b.badge_id));

  return (
    <div className="space-y-10">
      {/* ── Badges Section ──────────────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Badges</h2>
          <p className="text-sm text-stone-500 mt-1">Earn badges by participating in CSR activities and challenges.</p>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : allBadges.length === 0 ? (
          <EmptyState
            icon="🎖"
            title="No Badges Available"
            description="There are currently no badges defined for eco-milestones."
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

                  <Button
                    variant="primary"
                    onClick={() => handleRedeem(reward)}
                    disabled={reward.stock <= 0 || redeeming === reward.id}
                  >
                    {redeeming === reward.id ? "Redeeming…" : "Redeem"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
