/**
 * Dashboard API contracts for Atlas Operator Dashboard
 * @module contracts/dashboard-api
 */
import { z } from 'zod';
import {
  MetricPeriodSchema,
  TierSchema,
  CategorySchema,
} from './common';
import { PendingItemSchema, PendingActionResponseSchema, type PendingActionResponse } from './pending-item';

// Re-export for backwards compatibility
export { PendingItemSchema };
export type { PendingActionResponse };

// ============================================================================
// Dashboard Metrics
// ============================================================================

export const DashboardMetricsSchema = z.object({
  period: MetricPeriodSchema,
  leads_total: z.number().int().min(0),
  leads_by_tier: z.record(TierSchema, z.number().int()),
  replies_total: z.number().int().min(0),
  replies_by_category: z.record(CategorySchema, z.number().int()),
  avg_response_time_ms: z.number().min(0),
  briefs_generated: z.number().int().min(0),
  insights_extracted: z.number().int().min(0),
});
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

// ============================================================================
// Manual Trigger Requests
// ============================================================================

export const ManualScoreLeadRequestSchema = z.object({
  email: z.string().email(),
  company_name: z.string().optional(),
  force_rescore: z.boolean().default(false),
});
export type ManualScoreLeadRequest = z.infer<typeof ManualScoreLeadRequestSchema>;

export const ManualGenerateBriefRequestSchema = z.object({
  meeting_id: z.string().optional(),
  participant_email: z.string().email(),
});
export type ManualGenerateBriefRequest = z.infer<typeof ManualGenerateBriefRequestSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const PendingItemsResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(PendingItemSchema),
  total: z.number().int(),
});
export type PendingItemsResponse = z.infer<typeof PendingItemsResponseSchema>;

export const MetricsResponseSchema = z.object({
  success: z.literal(true),
  metrics: DashboardMetricsSchema,
});
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

export const ManualTriggerResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  request_id: z.string().uuid(),
});
export type ManualTriggerResponse = z.infer<typeof ManualTriggerResponseSchema>;

// Re-export PendingActionResponseSchema from pending-item for backwards compatibility
export { PendingActionResponseSchema };

// ============================================================================
// Health Check
// ============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.object({
    mcp_api: z.enum(['up', 'down']),
    qdrant: z.enum(['up', 'down']),
    redis: z.enum(['up', 'down']),
    agents: z.object({
      lead_scorer: z.enum(['up', 'down']),
      reply_handler: z.enum(['up', 'down']),
      meeting_prep: z.enum(['up', 'down']),
      learning_loop: z.enum(['up', 'down']),
    }),
  }),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// ============================================================================
// Authentication (Simple Token)
// ============================================================================
// Note: Authentication uses DASHBOARD_SECRET environment variable.
// API middleware validates X-Dashboard-Secret header against this value.
// No user accounts or login flows required.

export const AuthHeaderSchema = z.object({
  'x-dashboard-secret': z.string().min(1),
});
export type AuthHeader = z.infer<typeof AuthHeaderSchema>;
