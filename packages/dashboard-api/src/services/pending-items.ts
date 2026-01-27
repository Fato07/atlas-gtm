/**
 * Pending Items service
 *
 * Manages pending validation items from Learning Loop's Redis queue.
 * Transforms ValidationItem (from Learning Loop) to PendingItemWithStatus (for Dashboard).
 *
 * @module services/pending-items
 */

import {
  PendingItemWithStatus,
  PendingType,
  Urgency,
  ListPendingParams,
} from '../contracts';
import { listBrains } from './brains';
import {
  isRedisAvailable,
  getPendingValidations,
  getValidationItem,
  setValidationItem,
  deleteValidationItem,
} from './redis-client';

// =============================================================================
// Learning Loop ValidationItem Type (inline to avoid circular dependency)
// =============================================================================

/**
 * ValidationItem structure from Learning Loop.
 * Must match packages/agents/src/learning-loop/contracts/validation.ts
 */
interface ValidationItem {
  id: string;
  insight_id: string;
  brain_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  insight_summary: {
    id: string;
    category: string;
    content: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    source_type: 'email_reply' | 'call_transcript';
    company_name: string | null;
    extracted_quote: string | null;
  };
  slack: {
    channel_id: string;
    message_ts: string;
    sent_at: string;
  };
  reminders: {
    count: number;
    last_sent_at: string | null;
    next_due_at: string;
  };
  decision: {
    action: 'approved' | 'rejected';
    validated_by: string;
    validator_name: string;
    decided_at: string;
    note: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Type Transformation Helpers
// =============================================================================

/**
 * Map ValidationItem importance to Dashboard urgency.
 * Both use the same values: critical, high, medium, low
 */
function mapImportanceToUrgency(importance: ValidationItem['insight_summary']['importance']): Urgency {
  return importance; // Same enum values
}

/**
 * Build Slack message link from channel_id and message_ts.
 */
function buildSlackLink(slack: ValidationItem['slack']): string | null {
  if (!slack.channel_id || !slack.message_ts) return null;

  // Slack message URL format: https://app.slack.com/client/{workspace_id}/{channel_id}/p{message_ts_without_period}
  // Simplified format: https://slack.com/archives/{channel_id}/p{message_ts_without_period}
  const tsWithoutPeriod = slack.message_ts.replace('.', '');
  return `https://slack.com/archives/${slack.channel_id}/p${tsWithoutPeriod}`;
}

/**
 * Calculate time remaining until expiration.
 */
function calculateTimeRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;

  const now = Date.now();
  const expireTime = new Date(expiresAt).getTime();
  const remaining = expireTime - now;

  return remaining > 0 ? remaining : 0;
}

/**
 * Check if item is expiring soon (within 4 hours).
 */
function isExpiringSoon(expiresAt: string | null): boolean {
  const remaining = calculateTimeRemaining(expiresAt);
  if (remaining === null) return false;

  const fourHoursMs = 4 * 60 * 60 * 1000;
  return remaining < fourHoursMs;
}

/**
 * Transform a ValidationItem to PendingItemWithStatus.
 */
function transformValidationItem(item: ValidationItem): PendingItemWithStatus {
  const expiresAt = item.reminders.next_due_at;

  return {
    id: item.id,
    type: 'insight_validation' as PendingType,
    created_at: item.created_at,
    expires_at: expiresAt || null,
    urgency: mapImportanceToUrgency(item.insight_summary.importance),
    summary: item.insight_summary.content.slice(0, 500),
    slack_link: buildSlackLink(item.slack),
    context: {
      brain_id: item.brain_id,
      insight_id: item.insight_id,
      insight_category: item.insight_summary.category,
      confidence: item.insight_summary.confidence,
      source_type: item.insight_summary.source_type,
      company_name: item.insight_summary.company_name,
      extracted_quote: item.insight_summary.extracted_quote,
      reminder_count: item.reminders.count,
    },
    time_remaining_ms: calculateTimeRemaining(expiresAt),
    is_expiring_soon: isExpiringSoon(expiresAt),
  };
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * List pending items with optional filters.
 * Fetches from all brains' Redis queues and aggregates results.
 */
export async function listPendingItems(
  params?: ListPendingParams
): Promise<{ items: PendingItemWithStatus[]; total: number }> {
  if (!isRedisAvailable()) {
    console.log('[pending-items] Redis not connected, returning empty list');
    return { items: [], total: 0 };
  }

  try {
    // Get all active brains to fetch their pending validations
    const brains = await listBrains({ status: 'active' });
    console.log(`[pending-items] Fetching pending items for ${brains.length} active brains`);

    // Fetch pending validations from all brains
    const allItems: PendingItemWithStatus[] = [];

    for (const brain of brains) {
      const validations = await getPendingValidations<ValidationItem>(brain.brain_id);
      console.log(`[pending-items] Brain ${brain.brain_id}: ${validations.length} pending validations`);

      // Transform and filter only pending items
      for (const validation of validations) {
        if (validation.status !== 'pending') continue;

        const item = transformValidationItem(validation);

        // Apply type filter if provided
        if (params?.type && item.type !== params.type) continue;

        // Apply urgency filter if provided
        if (params?.urgency && item.urgency !== params.urgency) continue;

        allItems.push(item);
      }
    }

    // Sort by urgency (critical > high > medium > low) then by created_at (oldest first)
    const urgencyOrder: Record<Urgency, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    allItems.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    console.log(`[pending-items] Returning ${allItems.length} pending items`);
    return { items: allItems, total: allItems.length };
  } catch (error) {
    console.error('[pending-items] Error listing pending items:', error);
    return { items: [], total: 0 };
  }
}

/**
 * Get a single pending item by ID.
 */
export async function getPendingItem(
  itemId: string
): Promise<PendingItemWithStatus | null> {
  if (!isRedisAvailable()) {
    console.log('[pending-items] Redis not connected, item not found:', itemId);
    return null;
  }

  try {
    const validation = await getValidationItem<ValidationItem>(itemId);

    if (!validation) {
      console.log(`[pending-items] Validation item not found: ${itemId}`);
      return null;
    }

    return transformValidationItem(validation);
  } catch (error) {
    console.error('[pending-items] Error getting pending item:', error);
    return null;
  }
}

/**
 * Approve a pending item.
 * Updates the validation item status and removes it from the pending queue.
 */
export async function approvePendingItem(
  itemId: string,
  notes?: string
): Promise<{ success: boolean; item_id: string; action: 'approved' }> {
  if (!isRedisAvailable()) {
    console.error('[pending-items] Redis not connected, cannot approve item:', itemId);
    throw new Error('Pending items service not connected to Redis');
  }

  try {
    // Get the current validation item
    const validation = await getValidationItem<ValidationItem>(itemId);

    if (!validation) {
      throw new Error('Pending item not found');
    }

    if (validation.status !== 'pending') {
      throw new Error(`Cannot approve item with status: ${validation.status}`);
    }

    // Apply the approval decision
    const now = new Date().toISOString();
    const updatedValidation: ValidationItem = {
      ...validation,
      status: 'approved',
      decision: {
        action: 'approved',
        validated_by: 'dashboard', // Dashboard user, could be enhanced with actual user ID
        validator_name: 'Dashboard User',
        decided_at: now,
        note: notes ?? null,
      },
      updated_at: now,
    };

    // Save the updated item (preserve remaining TTL or set 24h for cleanup)
    await setValidationItem(itemId, updatedValidation, 24 * 60 * 60);

    // Remove from pending set
    await deleteValidationItem(itemId, validation.brain_id);

    console.log(`[pending-items] Approved validation item: ${itemId}`);
    return { success: true, item_id: itemId, action: 'approved' };
  } catch (error) {
    console.error('[pending-items] Error approving item:', error);
    throw error;
  }
}

/**
 * Reject a pending item.
 * Updates the validation item status and removes it from the pending queue.
 */
export async function rejectPendingItem(
  itemId: string,
  reason: string
): Promise<{ success: boolean; item_id: string; action: 'rejected' }> {
  if (!isRedisAvailable()) {
    console.error('[pending-items] Redis not connected, cannot reject item:', itemId);
    throw new Error('Pending items service not connected to Redis');
  }

  try {
    // Get the current validation item
    const validation = await getValidationItem<ValidationItem>(itemId);

    if (!validation) {
      throw new Error('Pending item not found');
    }

    if (validation.status !== 'pending') {
      throw new Error(`Cannot reject item with status: ${validation.status}`);
    }

    // Apply the rejection decision
    const now = new Date().toISOString();
    const updatedValidation: ValidationItem = {
      ...validation,
      status: 'rejected',
      decision: {
        action: 'rejected',
        validated_by: 'dashboard',
        validator_name: 'Dashboard User',
        decided_at: now,
        note: reason,
      },
      updated_at: now,
    };

    // Save the updated item (preserve remaining TTL or set 24h for cleanup)
    await setValidationItem(itemId, updatedValidation, 24 * 60 * 60);

    // Remove from pending set
    await deleteValidationItem(itemId, validation.brain_id);

    console.log(`[pending-items] Rejected validation item: ${itemId}`);
    return { success: true, item_id: itemId, action: 'rejected' };
  } catch (error) {
    console.error('[pending-items] Error rejecting item:', error);
    throw error;
  }
}

/**
 * Get count of pending items by urgency and type.
 */
export async function getPendingCounts(): Promise<{
  total: number;
  by_urgency: Record<Urgency, number>;
  by_type: Record<PendingType, number>;
}> {
  if (!isRedisAvailable()) {
    return {
      total: 0,
      by_urgency: { critical: 0, high: 0, medium: 0, low: 0 },
      by_type: { tier2_approval: 0, insight_validation: 0, escalation: 0 },
    };
  }

  try {
    // Get all items to calculate counts
    const { items } = await listPendingItems();

    const counts = {
      total: items.length,
      by_urgency: { critical: 0, high: 0, medium: 0, low: 0 } as Record<Urgency, number>,
      by_type: { tier2_approval: 0, insight_validation: 0, escalation: 0 } as Record<PendingType, number>,
    };

    for (const item of items) {
      counts.by_urgency[item.urgency]++;
      counts.by_type[item.type]++;
    }

    return counts;
  } catch (error) {
    console.error('[pending-items] Error getting pending counts:', error);
    return {
      total: 0,
      by_urgency: { critical: 0, high: 0, medium: 0, low: 0 },
      by_type: { tier2_approval: 0, insight_validation: 0, escalation: 0 },
    };
  }
}

// =============================================================================
// Type Display Names (unchanged)
// =============================================================================

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
