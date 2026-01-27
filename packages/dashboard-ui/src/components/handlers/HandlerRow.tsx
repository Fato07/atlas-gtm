/**
 * HandlerRow component
 * Displays a single objection handler in a list
 */
import { Trash2, BarChart3, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ObjectionHandler,
  getObjectionTypeDisplayName,
  getObjectionTypeColor,
  formatUsageStats,
} from '@/hooks/useHandlers';
import { cn } from '@/lib/utils';

interface HandlerRowProps {
  handler: ObjectionHandler;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export function HandlerRow({
  handler,
  isSelected,
  onClick,
  onDelete,
}: HandlerRowProps) {
  const stats = formatUsageStats(handler.usage_stats);

  return (
    <div
      className={cn(
        'group cursor-pointer border-b border-border p-4 transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Objection type badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn('text-xs', getObjectionTypeColor(handler.objection_type))}
            >
              {getObjectionTypeDisplayName(handler.objection_type)}
            </Badge>
            {handler.triggers.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {handler.triggers.length} trigger{handler.triggers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Strategy preview */}
          <p className="mt-2 line-clamp-2 text-sm text-foreground">
            {handler.handler_strategy}
          </p>

          {/* Triggers preview */}
          <div className="mt-2 flex flex-wrap gap-1">
            {handler.triggers.slice(0, 3).map((trigger, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                &quot;{trigger}&quot;
              </span>
            ))}
            {handler.triggers.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{handler.triggers.length - 3} more
              </span>
            )}
          </div>

          {/* Stats */}
          {handler.usage_stats && (
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {stats.matchedText}
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                {stats.usedText}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {stats.successRateText}
              </span>
            </div>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for HandlerRow
 */
export function HandlerRowSkeleton() {
  return (
    <div className="border-b border-border p-4">
      {/* Badge and trigger count */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
      {/* Strategy text */}
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
      <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-muted" />
      {/* Triggers */}
      <div className="mt-2 flex gap-1">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
      </div>
      {/* Stats */}
      <div className="mt-2 flex items-center gap-4">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-14 animate-pulse rounded bg-muted" />
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
