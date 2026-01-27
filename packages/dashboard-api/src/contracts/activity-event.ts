/**
 * Activity Event contracts for Atlas Operator Dashboard
 * @module contracts/activity-event
 */
import { z } from 'zod';
import { AgentNameSchema, EventTypeSchema, PaginatedResponseSchema } from './common';

// ============================================================================
// Activity Event
// ============================================================================

export const ActivityEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  agent: AgentNameSchema,
  event_type: EventTypeSchema,
  summary: z.string(),
  details_link: z.string().url().nullable(),
  lead_id: z.string().nullable(),
  brain_id: z.string().nullable(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const GetActivityFeedParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  agent: AgentNameSchema.optional(),
  event_type: EventTypeSchema.optional(),
  since: z.string().datetime().optional(),
});
export type GetActivityFeedParams = z.infer<typeof GetActivityFeedParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const ActivityFeedResponseSchema = z.object({
  success: z.literal(true),
  activities: z.array(ActivityEventSchema),
  total: z.number().int(),
  has_more: z.boolean(),
});
export type ActivityFeedResponse = z.infer<typeof ActivityFeedResponseSchema>;
