/**
 * ActivityFeed component
 * Displays real-time feed of Atlas activities with infinite scroll
 */
import { useRef, useCallback, useEffect } from 'react';
import { RefreshCw, Inbox, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ActivityItem } from './ActivityItem';
import {
  useInfiniteActivityFeed,
  flattenActivityPages,
} from '@/hooks/useActivity';

interface ActivityFeedProps {
  /** Maximum number of items per page */
  pageSize?: number;
  /** Filter by agent */
  agent?: string;
  /** Filter by event type */
  eventType?: string;
}

/**
 * Loading skeleton for activity items
 */
function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Empty state when no activities exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">
        No activities yet
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Activities will appear here as agents process leads, replies, and more.
      </p>
    </div>
  );
}

/**
 * Error state
 */
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">
        Failed to load activities
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

export function ActivityFeed({
  pageSize = 20,
  agent,
  eventType,
}: ActivityFeedProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    dataUpdatedAt,
  } = useInfiniteActivityFeed({
    limit: pageSize,
    agent,
    event_type: eventType,
  });

  const activities = flattenActivityPages(data?.pages);

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [handleObserver]);

  // Format last updated time
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 w-8"
            title="Refresh activities"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Loading state */}
        {isLoading && (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <ErrorState
            error={error instanceof Error ? error : new Error('Unknown error')}
            onRetry={() => refetch()}
          />
        )}

        {/* Empty state */}
        {!isLoading && !isError && activities.length === 0 && <EmptyState />}

        {/* Activity list */}
        {!isLoading && !isError && activities.length > 0 && (
          <div className="divide-y">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="h-1" />

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading more...
                </span>
              </div>
            )}

            {/* End of list indicator */}
            {!hasNextPage && activities.length > pageSize && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                You've reached the end
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
