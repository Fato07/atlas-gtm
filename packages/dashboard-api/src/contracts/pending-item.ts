/**
 * Pending Item contracts for Atlas Operator Dashboard
 * @module contracts/pending-item
 */
import { z } from 'zod';
import { PendingTypeSchema, UrgencySchema } from './common';

// ============================================================================
// Pending Item Entity
// ============================================================================

export const PendingItemSchema = z.object({
  id: z.string().min(1), // ValidationItem uses val_ prefix, not UUID
  type: PendingTypeSchema,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
  urgency: UrgencySchema,
  summary: z.string().min(1).max(500),
  slack_link: z.string().url().nullable(),
  context: z.record(z.unknown()).default({}),
});
export type PendingItem = z.infer<typeof PendingItemSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const ApproveItemRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type ApproveItemRequest = z.infer<typeof ApproveItemRequestSchema>;

export const RejectItemRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RejectItemRequest = z.infer<typeof RejectItemRequestSchema>;

export const ListPendingParamsSchema = z.object({
  type: PendingTypeSchema.optional(),
  urgency: UrgencySchema.optional(),
});
export type ListPendingParams = z.infer<typeof ListPendingParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const PendingListResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(PendingItemSchema),
  total: z.number().int(),
});
export type PendingListResponse = z.infer<typeof PendingListResponseSchema>;

export const PendingActionResponseSchema = z.object({
  success: z.literal(true),
  item_id: z.string().min(1),
  action: z.enum(['approved', 'rejected']),
});
export type PendingActionResponse = z.infer<typeof PendingActionResponseSchema>;

// ============================================================================
// Pending Item with computed fields
// ============================================================================

export const PendingItemWithStatusSchema = PendingItemSchema.extend({
  time_remaining_ms: z.number().nullable(),
  is_expiring_soon: z.boolean(),
});
export type PendingItemWithStatus = z.infer<typeof PendingItemWithStatusSchema>;
