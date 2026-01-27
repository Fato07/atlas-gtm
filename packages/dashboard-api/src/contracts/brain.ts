/**
 * Brain contracts for Atlas Operator Dashboard
 * @module contracts/brain
 */
import { z } from 'zod';
import { BrainStatusSchema } from './common';

// ============================================================================
// Brain Config
// ============================================================================

export const BrainConfigSchema = z.object({
  vertical: z.string().min(1),
  target_roles: z.array(z.string()).default([]),
  target_company_sizes: z.array(z.string()).default([]),
  geo_focus: z.array(z.string()).default([]),
  custom_settings: z.record(z.unknown()).optional(),
});
export type BrainConfig = z.infer<typeof BrainConfigSchema>;

// ============================================================================
// Brain Stats
// ============================================================================

export const BrainStatsSchema = z.object({
  icp_rules_count: z.number().int().min(0),
  templates_count: z.number().int().min(0),
  handlers_count: z.number().int().min(0),
  research_docs_count: z.number().int().min(0),
  insights_count: z.number().int().min(0),
});
export type BrainStats = z.infer<typeof BrainStatsSchema>;

// ============================================================================
// Brain Entity
// ============================================================================

export const BrainSchema = z.object({
  brain_id: z.string().regex(/^brain_[a-z0-9_]+$/),
  name: z.string().min(1).max(100),
  vertical: z.string().min(1).max(50),
  status: BrainStatusSchema,
  config: BrainConfigSchema,
  stats: BrainStatsSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Brain = z.infer<typeof BrainSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const CreateBrainRequestSchema = z.object({
  name: z.string().min(1).max(100),
  vertical: z.string().min(1).max(50),
  config: BrainConfigSchema.partial().optional(),
});
export type CreateBrainRequest = z.infer<typeof CreateBrainRequestSchema>;

export const UpdateBrainRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: BrainConfigSchema.partial().optional(),
});
export type UpdateBrainRequest = z.infer<typeof UpdateBrainRequestSchema>;

export const CloneBrainRequestSchema = z.object({
  source_brain_id: z.string(),
  new_name: z.string().min(1).max(100),
});
export type CloneBrainRequest = z.infer<typeof CloneBrainRequestSchema>;

export const ListBrainsParamsSchema = z.object({
  status: BrainStatusSchema.optional(),
  vertical: z.string().optional(),
});
export type ListBrainsParams = z.infer<typeof ListBrainsParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const BrainListResponseSchema = z.object({
  success: z.literal(true),
  brains: z.array(BrainSchema),
});
export type BrainListResponse = z.infer<typeof BrainListResponseSchema>;

export const BrainResponseSchema = z.object({
  success: z.literal(true),
  brain: BrainSchema,
});
export type BrainResponse = z.infer<typeof BrainResponseSchema>;

export const BrainActivateResponseSchema = z.object({
  success: z.literal(true),
  brain: BrainSchema,
  archived_brain_id: z.string().nullable(),
});
export type BrainActivateResponse = z.infer<typeof BrainActivateResponseSchema>;
