/**
 * React Query hooks for Pending Validations management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pendingApi } from '@/services/api';

// ============================================================================
// Types
// ============================================================================

export type PendingType = 'tier2_approval' | 'insight_validation' | 'escalation';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';

export interface PendingItem {
  id: string;
  type: PendingType;
  created_at: string;
  expires_at: string | null;
  urgency: Urgency;
  summary: string;
  slack_link: string | null;
  context: Record<string, unknown>;
}

export interface PendingItemWithStatus extends PendingItem {
  time_remaining_ms: number | null;
  is_expiring_soon: boolean;
}

export interface ListPendingParams {
  type?: PendingType;
  urgency?: Urgency;
}

export interface PendingCounts {
  total: number;
  by_urgency: Record<Urgency, number>;
  by_type: Record<PendingType, number>;
}

// ============================================================================
// Query Keys
// ============================================================================

export const pendingKeys = {
  all: ['pending'] as const,
  lists: () => [...pendingKeys.all, 'list'] as const,
  list: (params?: ListPendingParams) => [...pendingKeys.lists(), params] as const,
  details: () => [...pendingKeys.all, 'detail'] as const,
  detail: (id: string) => [...pendingKeys.details(), id] as const,
  counts: () => [...pendingKeys.all, 'counts'] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all pending items with optional filters
 */
export function usePendingItems(
  params?: ListPendingParams,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: pendingKeys.list(params),
    queryFn: async () => {
      const response = await pendingApi.getAll(params);
      return {
        items: response.items as PendingItemWithStatus[],
        total: response.total,
      };
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 30000, // Refresh every 30 seconds by default
  });
}

/**
 * Fetch a single pending item by ID
 */
export function usePendingItem(
  itemId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: pendingKeys.detail(itemId || ''),
    queryFn: async () => {
      if (!itemId) throw new Error('Item ID is required');
      const response = await pendingApi.getById(itemId);
      return response.item as PendingItemWithStatus;
    },
    enabled: !!itemId && (options?.enabled ?? true),
  });
}

/**
 * Fetch pending item counts by urgency and type
 */
export function usePendingCounts(options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey: pendingKeys.counts(),
    queryFn: async () => {
      const response = await pendingApi.getCounts();
      return {
        total: response.total,
        by_urgency: response.by_urgency as Record<Urgency, number>,
        by_type: response.by_type as Record<PendingType, number>,
      };
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 30000, // Refresh every 30 seconds
  });
}

/**
 * Approve a pending item
 */
export function useApprovePending() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes?: string }) => {
      return pendingApi.approve(itemId, notes);
    },
    onSuccess: () => {
      // Invalidate all pending queries to refresh the list
      queryClient.invalidateQueries({ queryKey: pendingKeys.all });
    },
  });
}

/**
 * Reject a pending item
 */
export function useRejectPending() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      return pendingApi.reject(itemId, reason);
    },
    onSuccess: () => {
      // Invalidate all pending queries to refresh the list
      queryClient.invalidateQueries({ queryKey: pendingKeys.all });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export const PENDING_TYPE_LABELS: Record<PendingType, string> = {
  tier2_approval: 'Tier 2 Approval',
  insight_validation: 'Insight Validation',
  escalation: 'Escalation',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const URGENCY_COLORS: Record<Urgency, { bg: string; text: string; border: string }> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-300 dark:border-red-800',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-950',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-300 dark:border-orange-800',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-950',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-300 dark:border-yellow-800',
  },
  low: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
  },
};

export const PENDING_TYPE_ICONS: Record<PendingType, string> = {
  tier2_approval: '👤',
  insight_validation: '💡',
  escalation: '🚨',
};

/**
 * Format time remaining in a human-readable way
 */
export function formatTimeRemaining(ms: number | null): string {
  if (ms === null) return 'No deadline';
  if (ms <= 0) return 'Expired';

  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/**
 * Get urgency badge class
 */
export function getUrgencyBadgeClass(urgency: Urgency): string {
  const colors = URGENCY_COLORS[urgency];
  return `${colors.bg} ${colors.text} ${colors.border} border`;
}
