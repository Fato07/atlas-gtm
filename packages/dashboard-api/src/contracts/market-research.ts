/**
 * Market Research contracts for Atlas Operator Dashboard
 * @module contracts/market-research
 */
import { z } from 'zod';
import { ContentTypeSchema, DocumentStatusSchema } from './common';

// ============================================================================
// Market Research Entity
// ============================================================================

export const MarketResearchSchema = z.object({
  id: z.string().uuid(),
  brain_id: z.string(),
  title: z.string().min(1).max(200),
  content_type: ContentTypeSchema,
  content: z.string().min(1).max(50000),
  key_facts: z.array(z.string()).default([]),
  source: z.string().max(500).nullable(),
  source_url: z.string().url().nullable(),
  tags: z.array(z.string()).default([]),
  status: DocumentStatusSchema,
  created_at: z.string().datetime(),
});
export type MarketResearch = z.infer<typeof MarketResearchSchema>;

// ============================================================================
// API Requests
// ============================================================================

export const CreateResearchRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content_type: ContentTypeSchema,
  content: z.string().min(1).max(50000),
  source: z.string().max(500).optional(),
  source_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateResearchRequest = z.infer<typeof CreateResearchRequestSchema>;

export const UpdateResearchRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  key_facts: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: DocumentStatusSchema.optional(),
});
export type UpdateResearchRequest = z.infer<typeof UpdateResearchRequestSchema>;

export const ListResearchParamsSchema = z.object({
  content_type: ContentTypeSchema.optional(),
  status: DocumentStatusSchema.optional(),
  tags: z.string().optional(), // comma-separated
  search: z.string().optional(),
});
export type ListResearchParams = z.infer<typeof ListResearchParamsSchema>;

// ============================================================================
// API Responses
// ============================================================================

export const ResearchListResponseSchema = z.object({
  success: z.literal(true),
  documents: z.array(MarketResearchSchema),
  total: z.number().int(),
});
export type ResearchListResponse = z.infer<typeof ResearchListResponseSchema>;

export const ResearchResponseSchema = z.object({
  success: z.literal(true),
  document: MarketResearchSchema,
});
export type ResearchResponse = z.infer<typeof ResearchResponseSchema>;

export const DeleteResearchResponseSchema = z.object({
  success: z.literal(true),
  deleted_id: z.string().uuid(),
});
export type DeleteResearchResponse = z.infer<typeof DeleteResearchResponseSchema>;

// Research with extracted facts (returned after create/update with AI extraction)
export const ResearchWithExtractionResponseSchema = z.object({
  success: z.literal(true),
  document: MarketResearchSchema,
  extracted_facts_count: z.number().int(),
});
export type ResearchWithExtractionResponse = z.infer<typeof ResearchWithExtractionResponseSchema>;
