/**
 * TemplateRow component
 * Displays a single template in a list view
 */
import { memo } from 'react';
import { Mail, Trash2, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponseTemplate,
  getReplyTypeDisplayName,
  getReplyTypeColor,
  getTierShortName,
  getTierColor,
  formatMetrics,
} from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';

interface TemplateRowProps {
  template: ResponseTemplate;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export const TemplateRow = memo(function TemplateRow({
  template,
  isSelected,
  onClick,
  onDelete,
}: TemplateRowProps) {
  const metrics = formatMetrics(template.metrics);

  // Get first line of template for preview
  const previewText =
    template.template_text.split('\n')[0].substring(0, 60) +
    (template.template_text.length > 60 ? '...' : '');

  return (
    <div
      className={cn(
        'group cursor-pointer rounded-lg border border-border p-3 transition-all hover:border-primary/50 hover:bg-accent/50',
        isSelected && 'border-primary bg-accent'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Badge
            variant="secondary"
            className={cn('text-xs', getReplyTypeColor(template.reply_type))}
          >
            {getReplyTypeDisplayName(template.reply_type)}
          </Badge>
          <Badge
            variant="outline"
            className={cn('text-xs', getTierColor(template.tier))}
          >
            {getTierShortName(template.tier)}
          </Badge>
        </div>

        {/* Delete button */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
      </div>

      {/* Preview text */}
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {previewText}
      </p>

      {/* Variables */}
      {template.variables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.variables.slice(0, 4).map((variable) => (
            <span
              key={variable}
              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {`{{${variable}}}`}
            </span>
          ))}
          {template.variables.length > 4 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              +{template.variables.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Metrics */}
      {template.metrics && (
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {metrics.replyRateText} reply rate
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {metrics.usageText}
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * Loading skeleton for TemplateRow
 */
export function TemplateRowSkeleton() {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-3/4" />
      <div className="mt-2 flex gap-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
