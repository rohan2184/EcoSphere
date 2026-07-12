/**
 * Leaderboard — ranks users by XP balance.
 */

import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  xp_balance: number;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const { data } = await api.get<LeaderboardEntry[]>("/gamification/leaderboard?limit=50");
        setEntries(data);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">🏆 Leaderboard</h1>
        <p className="text-stone-500">Top eco-champions ranked by XP.</p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-stone-400">Loading rankings…</p>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-center text-sm">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-stone-400">No users found.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-stone-50 text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-6 py-4 font-semibold w-24">Rank</th>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold text-right w-32">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.map((entry) => {
                const isMe = user?.id === entry.user_id;
                
                // Highlight top 3
                let rankBadge = <span className="font-medium text-stone-500">#{entry.rank}</span>;
                if (entry.rank === 1) rankBadge = <span className="text-xl">🥇</span>;
                else if (entry.rank === 2) rankBadge = <span className="text-xl">🥈</span>;
                else if (entry.rank === 3) rankBadge = <span className="text-xl">🥉</span>;

                return (
                  <tr
                    key={entry.user_id}
                    className={`transition-colors hover:bg-stone-50 ${
                      isMe ? "bg-emerald-50/30 font-medium" : ""
                    }`}
                  >
                    <td className="px-6 py-4">{rankBadge}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={isMe ? "text-emerald-900" : "text-stone-800"}>
                          {entry.name} {isMe && "(You)"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs">
                        {entry.xp_balance} XP
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
