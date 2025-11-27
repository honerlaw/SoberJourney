import { TrackerCard } from "./TrackerCard";

export const DashboardPage: React.FC = () => {
  return (
    <TrackerCard title="Alcohol" days={285} hours={23} minutes={1} lastResetDate={new Date()} streakCurrent={12} streakGoal={90} onReset={() => {}} />
  );
};