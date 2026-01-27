/**
 * Pending Items service
 * Manages pending validation items from Redis queue
 * TODO: Connect to Upstash Redis for real pending items
 */
import {
  PendingItemWithStatus,
  PendingType,
  Urgency,
  ListPendingParams,
} from '../contracts';

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List pending items with optional filters
 * TODO: Connect to Upstash Redis for real pending items
 */
export async function listPendingItems(
  _params?: ListPendingParams
): Promise<{ items: PendingItemWithStatus[]; total: number }> {
  // TODO: Fetch from Upstash Redis
  // For now, return empty array - no pending items until Redis is connected
  console.log('[pending-items] Redis not connected, returning empty list');
  return { items: [], total: 0 };
}

/**
 * Get a single pending item by ID
 * TODO: Connect to Upstash Redis for real pending items
 */
export async function getPendingItem(
  itemId: string
): Promise<PendingItemWithStatus | null> {
  // TODO: Fetch from Upstash Redis
  console.log('[pending-items] Redis not connected, item not found:', itemId);
  return null;
}

/**
 * Approve a pending item
 * TODO: Connect to Upstash Redis for real pending items
 */
export async function approvePendingItem(
  itemId: string,
  _notes?: string
): Promise<{ success: boolean; item_id: string; action: 'approved' }> {
  // TODO: Connect to Upstash Redis
  // 1. Remove item from Redis queue
  // 2. Trigger the appropriate action (e.g., approve tier 2 lead, validate insight)
  // 3. Log the action
  console.error('[pending-items] Redis not connected, cannot approve item:', itemId);
  throw new Error('Pending items service not connected to Redis');
}

/**
 * Reject a pending item
 * TODO: Connect to Upstash Redis for real pending items
 */
export async function rejectPendingItem(
  itemId: string,
  _reason: string
): Promise<{ success: boolean; item_id: string; action: 'rejected' }> {
  // TODO: Connect to Upstash Redis
  // 1. Remove item from Redis queue
  // 2. Log the rejection with reason
  // 3. Potentially notify relevant parties
  console.error('[pending-items] Redis not connected, cannot reject item:', itemId);
  throw new Error('Pending items service not connected to Redis');
}

/**
 * Get count of pending items by urgency
 * TODO: Connect to Upstash Redis for real pending items
 */
export async function getPendingCounts(): Promise<{
  total: number;
  by_urgency: Record<Urgency, number>;
  by_type: Record<PendingType, number>;
}> {
  // TODO: Fetch from Upstash Redis
  // For now, return zeros - no pending items until Redis is connected
  return {
    total: 0,
    by_urgency: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    by_type: {
      tier2_approval: 0,
      insight_validation: 0,
      escalation: 0,
    },
  };
}

// ============================================================================
// Type Display Names
// ============================================================================

export const PENDING_TYPE_DISPLAY_NAMES: Record<PendingType, string> = {
  tier2_approval: 'Tier 2 Approval',
  insight_validation: 'Insight Validation',
  escalation: 'Escalation',
};

export const URGENCY_DISPLAY_NAMES: Record<Urgency, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const URGENCY_COLORS: Record<Urgency, string> = {
  critical: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950',
  high: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950',
  medium: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950',
  low: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950',
};
