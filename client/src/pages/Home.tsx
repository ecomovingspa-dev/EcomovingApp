import DashboardMetrics from "../components/dashboard/DashboardMetrics";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-6">
      <div className="max-w-7xl mx-auto">
        <DashboardMetrics />
      </div>
    </div>
  );
}
