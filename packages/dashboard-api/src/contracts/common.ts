/**
 * Common types and enums for Atlas Operator Dashboard
 * @module contracts/common
 */
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const AgentNameSchema = z.enum([
  'lead_scorer',
  'reply_handler',
  'meeting_prep',
  'learning_loop',
]);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const HealthStatusSchema = z.enum(['healthy', 'warning', 'error', 'unknown']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const EventTypeSchema = z.enum([
  'lead_scored',
  'reply_classified',
  'reply_sent',
  'brief_generated',
  'brief_delivered',
  'insight_extracted',
  'insight_validated',
  'error',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const PendingTypeSchema = z.enum([
  'tier2_approval',
  'insight_validation',
  'escalation',
]);
export type PendingType = z.infer<typeof PendingTypeSchema>;

export const UrgencySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Urgency = z.infer<typeof UrgencySchema>;

export const BrainStatusSchema = z.enum(['draft', 'active', 'archived']);
export type BrainStatus = z.infer<typeof BrainStatusSchema>;

export const ICPCategorySchema = z.enum([
  'firmographic',
  'technographic',
  'behavioral',
  'engagement',
]);
export type ICPCategory = z.infer<typeof ICPCategorySchema>;

export const ReplyTypeSchema = z.enum([
  'positive_interest',
  'question',
  'objection',
  'not_interested',
  'out_of_office',
  'other',
]);
export type ReplyType = z.infer<typeof ReplyTypeSchema>;

export const ObjectionTypeSchema = z.enum([
  'budget',
  'timing',
  'competitor',
  'authority',
  'need',
  'trust',
  'other',
]);
export type ObjectionType = z.infer<typeof ObjectionTypeSchema>;

export const ContentTypeSchema = z.enum([
  'article',
  'report',
  'transcript',
  'notes',
  'other',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const DocumentStatusSchema = z.enum(['active', 'archived']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const MetricPeriodSchema = z.enum(['today', '7d', '30d']);
export type MetricPeriod = z.infer<typeof MetricPeriodSchema>;

export const TierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type Tier = z.infer<typeof TierSchema>;

export const CategorySchema = z.enum(['A', 'B', 'C']);
export type Category = z.infer<typeof CategorySchema>;

// ============================================================================
// Common Types
// ============================================================================

export const RuleOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'regex',
]);
export type RuleOperator = z.infer<typeof RuleOperatorSchema>;

export const RuleConditionSchema = z.object({
  operator: RuleOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  case_sensitive: z.boolean().optional(),
});
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

// ============================================================================
// API Response Wrapper
// ============================================================================

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Pagination
export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    has_more: z.boolean(),
  });
