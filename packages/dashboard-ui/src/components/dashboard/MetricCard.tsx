/**
 * MetricCard component
 * Displays a single metric with label, value, and optional trend indicator
 */
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

/**
 * MetricCard - Displays a single dashboard metric
 *
 * @example
 * <MetricCard
 *   label="Leads Scored"
 *   value={42}
 *   description="Today"
 *   trend="up"
 *   trendValue="+12%"
 * />
 */
export function MetricCard({
  label,
  value,
  description,
  trend,
  trendValue,
  icon,
  isLoading = false,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-error'
        : 'text-muted-foreground';

  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {trend && trendValue && (
            <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendValue}</span>
            </div>
          )}
          {description && (
            <span className="text-sm text-muted-foreground">{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
