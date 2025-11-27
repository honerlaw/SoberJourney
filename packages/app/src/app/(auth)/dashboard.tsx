import { DashboardPage } from "@/src/components/pages/DashboardPage";
import { ScrollView } from "tamagui";

export default function Dashboard() {
  return (
    <ScrollView margin="$4">
      <DashboardPage />
    </ScrollView>
  );
}
