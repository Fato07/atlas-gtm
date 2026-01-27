/**
 * Response Template contracts for Atlas Operator Dashboard
 * @module contracts/response-template
 */
import { z } from 'zod';
import { ReplyTypeSchema } from './common';

// ============================================================================
// Template Metrics
// ============================================================================

export const TemplateMetricsSchema = z.object({
  times_used: z.number().int().min(0),
  reply_rate: z.number().min(0).max(1),
  positive_rate: z.number().min(0).max(1),
  last_used: z.string().datetime().optional(),
});
export type TemplateMetrics = z.infer<typeof TemplateMetricsSchema>;

// ============================================================================
// Response Template Entity
// ============================================================================

export const ResponseTemplateSchema = z.object({
  id: z.string().uuid(),
  brain_id: z.string(),
  reply_type: ReplyTypeSchema,
  tier: z.number().int().min(1).max(3),
  template_text: z.string().min(1).max(5000),
  variables: z.array(z.string()).default([]),
  personalization: z.record(z.string()).default({}),
  metrics: TemplateMetricsSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type ResponseTemplate = z.infer<typeof ResponseTemplateSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const CreateTemplateRequestSchema = z.object({
  reply_type: ReplyTypeSchema,
  tier: z.number().int().min(1).max(3),
  template_text: z.string().min(1).max(5000),
  variables: z.array(z.string()).optional(),
  personalization: z.record(z.string()).optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = CreateTemplateRequestSchema.partial();
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

export const PreviewTemplateRequestSchema = z.object({
  template_text: z.string().min(1).max(5000),
  sample_data: z.record(z.string()).optional(),
});
export type PreviewTemplateRequest = z.infer<typeof PreviewTemplateRequestSchema>;

export const ListTemplatesParamsSchema = z.object({
  reply_type: ReplyTypeSchema.optional(),
  tier: z.coerce.number().int().min(1).max(3).optional(),
});
export type ListTemplatesParams = z.infer<typeof ListTemplatesParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const TemplateListResponseSchema = z.object({
  success: z.literal(true),
  templates: z.array(ResponseTemplateSchema),
  total: z.number().int(),
});
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;

export const TemplateResponseSchema = z.object({
  success: z.literal(true),
  template: ResponseTemplateSchema,
});
export type TemplateResponse = z.infer<typeof TemplateResponseSchema>;

export const PreviewTemplateResponseSchema = z.object({
  success: z.literal(true),
  preview: z.string(),
  detected_variables: z.array(z.string()),
});
export type PreviewTemplateResponse = z.infer<typeof PreviewTemplateResponseSchema>;

export const DeleteTemplateResponseSchema = z.object({
  success: z.literal(true),
  deleted_id: z.string().uuid(),
});
export type DeleteTemplateResponse = z.infer<typeof DeleteTemplateResponseSchema>;

// ============================================================================
// Variable Helpers
// ============================================================================

// Standard variables available in templates
export const STANDARD_TEMPLATE_VARIABLES = [
  'first_name',
  'last_name',
  'company_name',
  'title',
  'industry',
  'company_size',
  'location',
  'sender_name',
  'sender_title',
  'meeting_link',
  'calendar_link',
] as const;

export const StandardTemplateVariableSchema = z.enum(STANDARD_TEMPLATE_VARIABLES);
export type StandardTemplateVariable = z.infer<typeof StandardTemplateVariableSchema>;
