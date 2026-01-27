import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

/**
 * SkeletonLoader component with Claude-style shimmer animation
 * Used for loading states throughout the dashboard
 */
export function SkeletonLoader({
  className,
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonLoaderProps) {
  const baseClasses =
    'animate-shimmer bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
    card: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClasses, variantClasses.text)}
            style={{
              ...style,
              width: i === lines - 1 ? '60%' : width || '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  );
}

/**
 * Skeleton for agent status card
 */
export function AgentCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <SkeletonLoader variant="circular" width={40} height={40} />
          <div className="space-y-2">
            <SkeletonLoader variant="text" width={100} height={16} />
            <SkeletonLoader variant="text" width={60} height={12} />
          </div>
        </div>
        <SkeletonLoader variant="circular" width={12} height={12} />
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonLoader variant="text" width="80%" />
        <SkeletonLoader variant="text" width="60%" />
      </div>
    </div>
  );
}

/**
 * Skeleton for activity feed item
 */
export function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <SkeletonLoader variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <SkeletonLoader variant="text" width="70%" />
        <SkeletonLoader variant="text" width="40%" />
      </div>
      <SkeletonLoader variant="text" width={60} height={16} />
    </div>
  );
}

/**
 * Skeleton for brain card
 */
export function BrainCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLoader variant="text" width={120} height={18} />
          <SkeletonLoader variant="text" width={80} height={14} />
        </div>
        <SkeletonLoader variant="rectangular" width={60} height={24} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SkeletonLoader variant="rectangular" height={50} />
        <SkeletonLoader variant="rectangular" height={50} />
        <SkeletonLoader variant="rectangular" height={50} />
      </div>
    </div>
  );
}

/**
 * Skeleton for metric card
 */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <SkeletonLoader variant="text" width={100} height={14} />
      <SkeletonLoader variant="text" width={60} height={32} className="mt-2" />
      <SkeletonLoader variant="text" width={80} height={12} className="mt-2" />
    </div>
  );
}

/**
 * Grid of skeleton cards
 */
export function SkeletonGrid({
  count = 4,
  columns = 2,
  children,
}: {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  children?: (index: number) => React.ReactNode;
}) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns])}>
      {Array.from({ length: count }).map((_, i) =>
        children ? children(i) : <AgentCardSkeleton key={i} />
      )}
    </div>
  );
}
