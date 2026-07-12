import { useSearchParams } from "react-router-dom";
import TabBar from "../../components/TabBar";
import ChallengeList from "./ChallengeList";
import BadgesAndRewards from "./BadgesAndRewards";
import Leaderboard from "./Leaderboard";

const TABS = [
  { key: "challenges",      label: "Challenges",      icon: "🏆" },
  { key: "badges-rewards",  label: "Badges & Rewards", icon: "🎖" },
  { key: "leaderboard",     label: "Leaderboard",     icon: "📊" },
];

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  "challenges":     ChallengeList,
  "badges-rewards": BadgesAndRewards,
  "leaderboard":    Leaderboard,
};

export default function GamificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "challenges";

  function handleTabChange(key: string) {
    setSearchParams({ tab: key }, { replace: true });
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? ChallengeList;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Gamification</h1>
        <p className="text-sm text-stone-500">
          Challenges, badges, rewards, and the leaderboard.
        </p>
      </div>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
      <ActiveComponent />
    </div>
  );
}
