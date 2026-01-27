import { AgentStatusGrid } from '@/components/dashboard/AgentStatusGrid';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { PendingValidations } from '@/components/pending';
import { MetricsSummary } from '@/components/dashboard/MetricsSummary';

/**
 * Dashboard page - Main landing page
 * Shows agent status, activity feed, pending validations, and metrics
 *
 * Components implemented:
 * - AgentStatusGrid (US1) ✓
 * - ActivityFeed (US2) ✓
 * - PendingValidations (US8) ✓
 * - MetricsSummary (US9) ✓
 */
export function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor Atlas GTM agents and recent activity
        </p>
      </div>

      {/* Agent Status Grid - US1 Complete */}
      <section aria-labelledby="agents-heading">
        <AgentStatusGrid />
      </section>

      {/* Two column layout for Activity and Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed - US2 Complete */}
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="sr-only">
            Recent Activity
          </h2>
          <ActivityFeed pageSize={10} />
        </section>

        {/* Pending Validations - US8 Complete */}
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="sr-only">
            Pending Validations
          </h2>
          <PendingValidations maxHeight="500px" />
        </section>
      </div>

      {/* Metrics Summary - US9 Complete */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Key Metrics
        </h2>
        <MetricsSummary />
      </section>
    </div>
  );
}
