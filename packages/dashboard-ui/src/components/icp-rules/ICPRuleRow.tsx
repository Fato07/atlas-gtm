/**
 * ICPRuleRow component
 * Displays a single ICP rule in the list view
 */
import { Zap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ICPRule,
  getCategoryColor,
  getCategoryDisplayName,
  formatCondition,
  getWeightColor,
} from '@/hooks/useICPRules';
import { cn } from '@/lib/utils';

interface ICPRuleRowProps {
  rule: ICPRule;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export function ICPRuleRow({
  rule,
  isSelected,
  onClick,
  onDelete,
}: ICPRuleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
              getCategoryColor(rule.category)
            )}
          >
            {getCategoryDisplayName(rule.category)}
          </span>
          {rule.is_knockout && (
            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
              <Zap className="h-3 w-3" />
              Knockout
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-foreground">
          {rule.display_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {rule.attribute}: {formatCondition(rule.condition)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'min-w-[3rem] text-right text-sm font-semibold',
            getWeightColor(rule.score_weight)
          )}
        >
          {rule.score_weight > 0 ? '+' : ''}
          {rule.score_weight}
        </span>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for ICPRuleRow
 */
export function ICPRuleRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-10 animate-pulse rounded bg-muted" />
    </div>
  );
}
