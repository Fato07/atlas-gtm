import { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AgentStatus,
  HealthStatus,
  AGENT_DISPLAY_NAMES,
  AGENT_DESCRIPTIONS,
  getStatusColor,
  getStatusBgColor,
  formatRelativeTime,
} from '@/hooks/useAgentStatus';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: AgentStatus;
}

/**
 * Custom hook to detect status changes and trigger animation
 */
function useStatusChangeAnimation(status: HealthStatus): boolean {
  const [isAnimating, setIsAnimating] = useState(false);
  const previousStatusRef = useRef<HealthStatus | null>(null);

  useEffect(() => {
    // Skip animation on initial mount
    if (previousStatusRef.current === null) {
      previousStatusRef.current = status;
      return;
    }

    // Trigger animation if status changed
    if (previousStatusRef.current !== status) {
      setIsAnimating(true);
      previousStatusRef.current = status;

      // Remove animation class after animation completes
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 1000); // Animation duration

      return () => clearTimeout(timer);
    }
  }, [status]);

  return isAnimating;
}

/**
 * Get icon for status
 */
function StatusIcon({ status }: { status: HealthStatus }) {
  const iconClasses = cn('h-5 w-5', getStatusColor(status));

  switch (status) {
    case 'healthy':
      return <CheckCircle className={iconClasses} />;
    case 'warning':
      return <AlertTriangle className={iconClasses} />;
    case 'error':
      return <XCircle className={iconClasses} />;
    default:
      return <HelpCircle className={iconClasses} />;
  }
}

/**
 * Format metrics based on agent type
 */
function formatMetrics(agent: AgentStatus): { label: string; value: number | string }[] {
  const metrics: { label: string; value: number | string }[] = [
    { label: 'Processed Today', value: agent.metrics.processed_today },
    { label: 'Errors Today', value: agent.metrics.errors_today },
  ];

  // Add agent-specific metrics
  switch (agent.name) {
    case 'lead_scorer':
      if (agent.metrics.avg_score !== undefined) {
        metrics.push({ label: 'Avg Score', value: Math.round(agent.metrics.avg_score) });
      }
      break;
    case 'reply_handler':
      if (agent.metrics.auto_sent !== undefined) {
        metrics.push({ label: 'Auto-Sent', value: agent.metrics.auto_sent });
      }
      if (agent.metrics.pending_approval !== undefined) {
        metrics.push({ label: 'Pending', value: agent.metrics.pending_approval });
      }
      break;
    case 'meeting_prep':
      if (agent.metrics.briefs_today !== undefined) {
        metrics.push({ label: 'Briefs', value: agent.metrics.briefs_today });
      }
      break;
    case 'learning_loop':
      if (agent.metrics.insights_today !== undefined) {
        metrics.push({ label: 'Insights', value: agent.metrics.insights_today });
      }
      if (agent.metrics.pending_validation !== undefined) {
        metrics.push({ label: 'Pending', value: agent.metrics.pending_validation });
      }
      break;
  }

  return metrics;
}

/**
 * Agent status card component
 * Displays health status, metrics, and last activity for a single agent
 * Animates on status changes for visual feedback
 */
export function AgentCard({ agent }: AgentCardProps) {
  const displayName = AGENT_DISPLAY_NAMES[agent.name];
  const description = AGENT_DESCRIPTIONS[agent.name];
  const metrics = formatMetrics(agent);
  const isStatusChanging = useStatusChangeAnimation(agent.status);

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 hover:shadow-md',
        // Subtle pulse animation on status change
        isStatusChanging && 'ring-2 ring-primary/50 shadow-lg animate-pulse'
      )}
    >
      {/* Status indicator strip with transition */}
      <div
        className={cn(
          'absolute left-0 top-0 h-1 w-full transition-colors duration-500',
          getStatusBgColor(agent.status)
        )}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Agent icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>

            <div>
              <CardTitle className="text-base font-medium">{displayName}</CardTitle>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>

          {/* Status icon */}
          <StatusIcon status={agent.status} />
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {/* Error message if present */}
        {agent.error_message && (
          <div className="mb-3 rounded-md bg-error/10 px-3 py-2 text-sm text-error">
            {agent.error_message}
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="text-lg font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* Last activity */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Last activity</span>
          <span>{formatRelativeTime(agent.last_activity)}</span>
        </div>

        {/* Activity summary if present */}
        {agent.last_activity_summary && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {agent.last_activity_summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
