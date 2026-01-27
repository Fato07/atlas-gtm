/**
 * PendingValidations - List of pending validation items with filters
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PendingCard, PendingCardSkeleton } from './PendingCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import {
  usePendingItems,
  usePendingCounts,
  useApprovePending,
  useRejectPending,
  PendingType,
  Urgency,
  PENDING_TYPE_LABELS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  ListPendingParams,
} from '@/hooks/usePending';
import { AlertCircle, Filter, RefreshCw, ClipboardCheck } from 'lucide-react';

interface PendingValidationsProps {
  /** Maximum height for the scrollable list */
  maxHeight?: string;
  /** Show filter controls */
  showFilters?: boolean;
  /** Show header with counts */
  showHeader?: boolean;
  /** Callback when an item is handled (approved/rejected) */
  onItemHandled?: () => void;
}

export function PendingValidations({
  maxHeight = '600px',
  showFilters = true,
  showHeader = true,
  onItemHandled,
}: PendingValidationsProps) {
  const [filters, setFilters] = useState<ListPendingParams>({});

  const { data, isLoading, error, refetch, isRefetching } = usePendingItems(filters, {
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: counts } = usePendingCounts({
    refetchInterval: 30000,
  });

  const approveMutation = useApprovePending();
  const rejectMutation = useRejectPending();

  const handleApprove = (itemId: string, notes?: string) => {
    approveMutation.mutate(
      { itemId, notes },
      {
        onSuccess: () => {
          onItemHandled?.();
        },
      }
    );
  };

  const handleReject = (itemId: string, reason: string) => {
    rejectMutation.mutate(
      { itemId, reason },
      {
        onSuccess: () => {
          onItemHandled?.();
        },
      }
    );
  };

  const handleTypeFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      type: value === 'all' ? undefined : (value as PendingType),
    }));
  };

  const handleUrgencyFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      urgency: value === 'all' ? undefined : (value as Urgency),
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasFilters = filters.type || filters.urgency;

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Pending Validations
                {counts && counts.total > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {counts.total}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Items requiring your attention
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Urgency summary badges */}
          {counts && (
            <div className="flex gap-2 mt-2">
              {(['critical', 'high', 'medium', 'low'] as Urgency[]).map((urgency) => {
                const count = counts.by_urgency[urgency] || 0;
                if (count === 0) return null;
                const colors = URGENCY_COLORS[urgency];
                return (
                  <Badge
                    key={urgency}
                    className={`${colors.bg} ${colors.text} ${colors.border} border cursor-pointer`}
                    onClick={() => handleUrgencyFilter(filters.urgency === urgency ? 'all' : urgency)}
                  >
                    {URGENCY_LABELS[urgency]}: {count}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardHeader>
      )}

      <CardContent>
        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filters.type || 'all'}
              onValueChange={handleTypeFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(PENDING_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.urgency || 'all'}
              onValueChange={handleUrgencyFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All urgencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgencies</SelectItem>
                {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <PendingCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message="Failed to load pending items"
            onRetry={() => refetch()}
          />
        ) : !data?.items.length ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No pending items"
            description={
              hasFilters
                ? 'Try adjusting your filters'
                : 'All validations have been processed'
            }
          />
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-3 pr-4">
              {data.items.map((item) => (
                <PendingCard
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isApproving={
                    approveMutation.isPending &&
                    approveMutation.variables?.itemId === item.id
                  }
                  isRejecting={
                    rejectMutation.isPending &&
                    rejectMutation.variables?.itemId === item.id
                  }
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
