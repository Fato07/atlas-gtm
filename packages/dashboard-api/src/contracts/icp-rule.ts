/**
 * ICP Rule contracts for Atlas Operator Dashboard
 * @module contracts/icp-rule
 */
import { z } from 'zod';
import { ICPCategorySchema, RuleConditionSchema } from './common';

// ============================================================================
// ICP Rule Entity
// ============================================================================

export const ICPRuleSchema = z.object({
  id: z.string().uuid(),
  brain_id: z.string(),
  category: ICPCategorySchema,
  attribute: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  condition: RuleConditionSchema,
  score_weight: z.number().int().min(-100).max(100),
  is_knockout: z.boolean().default(false),
  reasoning: z.string().max(500).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type ICPRule = z.infer<typeof ICPRuleSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const CreateICPRuleRequestSchema = z.object({
  category: ICPCategorySchema,
  attribute: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  condition: RuleConditionSchema,
  score_weight: z.number().int().min(-100).max(100),
  is_knockout: z.boolean().default(false),
  reasoning: z.string().max(500).optional(),
});
export type CreateICPRuleRequest = z.infer<typeof CreateICPRuleRequestSchema>;

export const UpdateICPRuleRequestSchema = CreateICPRuleRequestSchema.partial();
export type UpdateICPRuleRequest = z.infer<typeof UpdateICPRuleRequestSchema>;

export const BulkImportICPRulesRequestSchema = z.object({
  rules: z.array(CreateICPRuleRequestSchema).min(1).max(100),
  replace_existing: z.boolean().default(false),
});
export type BulkImportICPRulesRequest = z.infer<typeof BulkImportICPRulesRequestSchema>;

export const ListICPRulesParamsSchema = z.object({
  category: ICPCategorySchema.optional(),
  is_knockout: z.coerce.boolean().optional(),
  search: z.string().optional(),
});
export type ListICPRulesParams = z.infer<typeof ListICPRulesParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const ICPRuleListResponseSchema = z.object({
  success: z.literal(true),
  rules: z.array(ICPRuleSchema),
  total: z.number().int(),
});
export type ICPRuleListResponse = z.infer<typeof ICPRuleListResponseSchema>;

export const ICPRuleResponseSchema = z.object({
  success: z.literal(true),
  rule: ICPRuleSchema,
});
export type ICPRuleResponse = z.infer<typeof ICPRuleResponseSchema>;

export const BulkImportICPRulesResponseSchema = z.object({
  success: z.literal(true),
  imported: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(
    z.object({
      index: z.number().int(),
      error: z.string(),
    })
  ),
});
export type BulkImportICPRulesResponse = z.infer<typeof BulkImportICPRulesResponseSchema>;

export const DeleteICPRuleResponseSchema = z.object({
  success: z.literal(true),
  deleted_id: z.string().uuid(),
});
export type DeleteICPRuleResponse = z.infer<typeof DeleteICPRuleResponseSchema>;
