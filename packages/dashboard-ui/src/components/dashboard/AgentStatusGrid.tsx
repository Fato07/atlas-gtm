import { RefreshCw } from 'lucide-react';
import { useAgentStatuses } from '@/hooks/useAgentStatus';
import { useSSE } from '@/hooks/useSSE';
import { AgentCard } from './AgentCard';
import { AgentCardSkeleton, SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Live indicator component - shows pulsing dot when SSE connected
 */
function LiveIndicator({ isConnected }: { isConnected: boolean }) {
  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-success">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="font-medium">Live</span>
    </div>
  );
}

/**
 * Agent status grid component
 * Displays health status of all 4 Atlas agents in a 2x2 grid
 * Uses SSE for real-time updates with fallback polling
 */
export function AgentStatusGrid() {
  const { data: agents, isLoading, isError, error, refetch, isFetching } = useAgentStatuses();
  const { isConnected, status: sseStatus } = useSSE();

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Agent Status</h2>
        </div>
        <SkeletonGrid count={4} columns={2}>
          {(i) => <AgentCardSkeleton key={i} />}
        </SkeletonGrid>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Agent Status</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <div className="rounded-lg border border-error/50 bg-error/10 p-4 text-center">
          <p className="text-sm text-error">
            Failed to load agent statuses
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  // Empty state (shouldn't happen but handle gracefully)
  if (!agents || agents.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Agent Status</h2>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No agents found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with live indicator and refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-foreground">Agent Status</h2>
          <LiveIndicator isConnected={isConnected} />
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          {!isConnected && (
            <span className="text-xs text-muted-foreground">
              {sseStatus === 'reconnecting' ? 'Reconnecting...' : 'Polling every 30s'}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title={isConnected ? 'Manual refresh' : 'Refresh'}
          >
            <RefreshCw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2x2 Grid of agent cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          {agents.filter((a) => a.status === 'healthy').length} of {agents.length} agents healthy
        </span>
        <span className="text-xs text-muted-foreground">
          {agents.reduce((sum, a) => sum + a.metrics.processed_today, 0)} items processed today
        </span>
      </div>
    </div>
  );
}
