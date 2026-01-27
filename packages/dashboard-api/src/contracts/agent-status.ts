/**
 * Agent Status contracts for Atlas Operator Dashboard
 * @module contracts/agent-status
 */
import { z } from 'zod';
import { AgentNameSchema, HealthStatusSchema, TierSchema, CategorySchema } from './common';

// ============================================================================
// Agent Metrics
// ============================================================================

export const BaseAgentMetricsSchema = z.object({
  processed_today: z.number().int().min(0),
  errors_today: z.number().int().min(0),
});

export const LeadScorerMetricsSchema = BaseAgentMetricsSchema.extend({
  avg_score: z.number().min(0).max(100).optional(),
  tier_distribution: z.record(TierSchema, z.number().int()).optional(),
});

export const ReplyHandlerMetricsSchema = BaseAgentMetricsSchema.extend({
  auto_sent: z.number().int().min(0).optional(),
  pending_approval: z.number().int().min(0).optional(),
});

export const MeetingPrepMetricsSchema = BaseAgentMetricsSchema.extend({
  briefs_today: z.number().int().min(0).optional(),
});

export const LearningLoopMetricsSchema = BaseAgentMetricsSchema.extend({
  insights_today: z.number().int().min(0).optional(),
  pending_validation: z.number().int().min(0).optional(),
});

export const AgentMetricsSchema = z.union([
  LeadScorerMetricsSchema,
  ReplyHandlerMetricsSchema,
  MeetingPrepMetricsSchema,
  LearningLoopMetricsSchema,
]);
export type AgentMetrics = z.infer<typeof AgentMetricsSchema>;

// ============================================================================
// Agent Status
// ============================================================================

export const AgentStatusSchema = z.object({
  name: AgentNameSchema,
  status: HealthStatusSchema,
  last_activity: z.string().datetime().nullable(),
  last_activity_summary: z.string().nullable(),
  error_message: z.string().nullable(),
  metrics: AgentMetricsSchema,
  endpoint: z.string().url(),
});
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const AgentStatusListResponseSchema = z.object({
  success: z.literal(true),
  agents: z.array(AgentStatusSchema),
  timestamp: z.string().datetime(),
});
export type AgentStatusListResponse = z.infer<typeof AgentStatusListResponseSchema>;

export const AgentHealthResponseSchema = z.object({
  success: z.literal(true),
  agent: AgentStatusSchema,
});
export type AgentHealthResponse = z.infer<typeof AgentHealthResponseSchema>;
