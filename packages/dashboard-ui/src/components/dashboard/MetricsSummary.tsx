/**
 * MetricsSummary component
 * Displays aggregated metrics with period selector
 */
import { useState } from 'react';
import { Users, MessageSquare, FileText, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MetricCard } from './MetricCard';
import { useMetricsSummary, type MetricsPeriod } from '@/hooks/useMetrics';

interface MetricsSummaryProps {
  className?: string;
}

const periodLabels: Record<MetricsPeriod, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
};

/**
 * MetricsSummary - Dashboard metrics grid with period selector
 */
export function MetricsSummary({ className }: MetricsSummaryProps) {
  const [period, setPeriod] = useState<MetricsPeriod>('today');
  const { data, isLoading, error } = useMetricsSummary({ period });

  if (error) {
    return (
      <div className={cn('rounded-lg border border-error/20 bg-error/10 p-4', className)}>
        <p className="text-sm text-error">Failed to load metrics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Key Metrics</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(Object.keys(periodLabels) as MetricsPeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p)}
              className={cn(
                'h-7 text-xs transition-all',
                period === p
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Leads Scored"
          value={data?.leads_scored ?? 0}
          description={`${data?.tier1_count ?? 0} Tier 1`}
          icon={<Users className="h-5 w-5" />}
          isLoading={isLoading}
        />

        <MetricCard
          label="Replies Classified"
          value={data?.replies_classified ?? 0}
          description={`${data?.interested_count ?? 0} interested`}
          icon={<MessageSquare className="h-5 w-5" />}
          isLoading={isLoading}
        />

        <MetricCard
          label="Briefs Generated"
          value={data?.briefs_generated ?? 0}
          description={periodLabels[period]}
          icon={<FileText className="h-5 w-5" />}
          isLoading={isLoading}
        />

        <MetricCard
          label="Insights Extracted"
          value={data?.insights_extracted ?? 0}
          description={periodLabels[period]}
          icon={<Lightbulb className="h-5 w-5" />}
          isLoading={isLoading}
        />
      </div>

      {/* Loading skeleton for initial load */}
      {isLoading && !data && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Skeleton className="h-3 w-3 animate-spin rounded-full" />
          <span>Loading metrics...</span>
        </div>
      )}
    </div>
  );
}

export default MetricsSummary;
