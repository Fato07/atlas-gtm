/**
 * Objection Handler contracts for Atlas Operator Dashboard
 * @module contracts/objection-handler
 */
import { z } from 'zod';
import { ObjectionTypeSchema } from './common';

// ============================================================================
// Usage Stats
// ============================================================================

export const UsageStatsSchema = z.object({
  times_matched: z.number().int().min(0),
  times_used: z.number().int().min(0),
  success_rate: z.number().min(0).max(1),
  last_matched: z.string().datetime().optional(),
});
export type UsageStats = z.infer<typeof UsageStatsSchema>;

// ============================================================================
// Objection Handler Entity
// ============================================================================

export const ObjectionHandlerSchema = z.object({
  id: z.string().uuid(),
  brain_id: z.string(),
  objection_type: ObjectionTypeSchema,
  triggers: z.array(z.string()).min(1),
  handler_strategy: z.string().min(1).max(1000),
  response: z.string().min(1).max(5000),
  variables: z.array(z.string()).default([]),
  follow_ups: z.array(z.string()).default([]),
  usage_stats: UsageStatsSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type ObjectionHandler = z.infer<typeof ObjectionHandlerSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const CreateHandlerRequestSchema = z.object({
  objection_type: ObjectionTypeSchema,
  triggers: z.array(z.string().min(1)).min(1).max(20),
  handler_strategy: z.string().min(1).max(1000),
  response: z.string().min(1).max(5000),
  variables: z.array(z.string()).optional(),
  follow_ups: z.array(z.string()).optional(),
});
export type CreateHandlerRequest = z.infer<typeof CreateHandlerRequestSchema>;

export const UpdateHandlerRequestSchema = CreateHandlerRequestSchema.partial();
export type UpdateHandlerRequest = z.infer<typeof UpdateHandlerRequestSchema>;

export const TestMatchHandlerRequestSchema = z.object({
  objection_text: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(10).default(5),
});
export type TestMatchHandlerRequest = z.infer<typeof TestMatchHandlerRequestSchema>;

export const ListHandlersParamsSchema = z.object({
  objection_type: ObjectionTypeSchema.optional(),
  search: z.string().optional(),
});
export type ListHandlersParams = z.infer<typeof ListHandlersParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const HandlerListResponseSchema = z.object({
  success: z.literal(true),
  handlers: z.array(ObjectionHandlerSchema),
  total: z.number().int(),
});
export type HandlerListResponse = z.infer<typeof HandlerListResponseSchema>;

export const HandlerResponseSchema = z.object({
  success: z.literal(true),
  handler: ObjectionHandlerSchema,
});
export type HandlerResponse = z.infer<typeof HandlerResponseSchema>;

export const TestMatchHandlerResponseSchema = z.object({
  success: z.literal(true),
  matches: z.array(
    z.object({
      handler: ObjectionHandlerSchema,
      confidence: z.number().min(0).max(1),
    })
  ),
});
export type TestMatchHandlerResponse = z.infer<typeof TestMatchHandlerResponseSchema>;

export const DeleteHandlerResponseSchema = z.object({
  success: z.literal(true),
  deleted_id: z.string().uuid(),
});
export type DeleteHandlerResponse = z.infer<typeof DeleteHandlerResponseSchema>;
