/**
 * ActivityItem component
 * Displays a single activity event in the activity feed
 */
import {
  Target,
  MessageSquare,
  Send,
  FileText,
  Bell,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';
import type { ActivityEvent } from '@/hooks/useActivity';

interface ActivityItemProps {
  activity: ActivityEvent;
}

// Event type configuration
const eventConfig: Record<
  ActivityEvent['event_type'],
  { icon: LucideIcon; color: string; label: string }
> = {
  lead_scored: {
    icon: Target,
    color: 'text-blue-600 bg-blue-100',
    label: 'Lead Scored',
  },
  reply_classified: {
    icon: MessageSquare,
    color: 'text-purple-600 bg-purple-100',
    label: 'Reply Classified',
  },
  reply_sent: {
    icon: Send,
    color: 'text-green-600 bg-green-100',
    label: 'Reply Sent',
  },
  brief_generated: {
    icon: FileText,
    color: 'text-amber-600 bg-amber-100',
    label: 'Brief Generated',
  },
  brief_delivered: {
    icon: Bell,
    color: 'text-teal-600 bg-teal-100',
    label: 'Brief Delivered',
  },
  insight_extracted: {
    icon: Lightbulb,
    color: 'text-yellow-600 bg-yellow-100',
    label: 'Insight Extracted',
  },
  insight_validated: {
    icon: CheckCircle,
    color: 'text-emerald-600 bg-emerald-100',
    label: 'Insight Validated',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600 bg-red-100',
    label: 'Error',
  },
};

// Agent display names
const agentNames: Record<ActivityEvent['agent'], string> = {
  lead_scorer: 'Lead Scorer',
  reply_handler: 'Reply Handler',
  meeting_prep: 'Meeting Prep',
  learning_loop: 'Learning Loop',
};

/**
 * Format relative time (e.g., "2 minutes ago", "1 hour ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Format full timestamp for tooltip
 */
function formatFullTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const config = eventConfig[activity.event_type];
  const Icon = config.icon;
  const agentName = agentNames[activity.agent];

  return (
    <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
      {/* Event icon */}
      <div className={`mt-0.5 rounded-full p-2 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Summary */}
        <p className="text-sm font-medium text-foreground">{activity.summary}</p>

        {/* Meta info */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {/* Agent badge */}
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
            {agentName}
          </span>

          {/* Event type */}
          <span>{config.label}</span>

          {/* Separator */}
          <span className="text-muted-foreground/50">•</span>

          {/* Timestamp with tooltip */}
          <time
            dateTime={activity.timestamp}
            title={formatFullTime(activity.timestamp)}
            className="cursor-help"
          >
            {formatRelativeTime(activity.timestamp)}
          </time>
        </div>
      </div>

      {/* Details link (if available) */}
      {activity.details_link && (
        <a
          href={activity.details_link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-primary hover:underline"
        >
          Details →
        </a>
      )}
    </div>
  );
}
