import { PageHeader } from "../shared/PageHeader";
import { MetricCard } from "../shared/MetricCard";
import { ReportsTable } from "../shared/ReportsTable";
import { AlertCard } from "../shared/AlertCard";
import { InsightCard } from "../shared/InsightCard";
import { RiskDistributionChart } from "../shared/RiskDistributionChart";
import { RecentActivityPanel } from "../shared/RecentActivityPanel";
import { mockDashboardData } from "../mock-data/dashboard";

export function DashboardPage() {
  const data = mockDashboardData;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Morning, Dr. Hernandez"
        subtitle="Here’s a snapshot of today’s report risk, triage queue, and key AI findings."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <ReportsTable reports={data.reportsQueue} />
          <RecentActivityPanel items={data.recentActivity} />
        </div>
        <div className="space-y-4">
          <RiskDistributionChart distribution={data.riskDistribution} />
          <AlertCard alerts={data.urgentAlerts} />
          <InsightCard insight={data.aiInsight} />
        </div>
      </section>
    </div>
  );
}

