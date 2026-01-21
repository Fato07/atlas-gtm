/**
 * Reply Handler Insight Extraction Tool
 *
 * Defines the structured output schema for Claude's insight extraction.
 * Used by INSIGHT_TOOL for type-safe structured outputs.
 *
 * Implements: FR-004 (Reply Handler insight extractor MUST use buildTool)
 *
 * @module reply-handler/contracts/insight-tool
 */

import { z } from 'zod';
import { buildTool } from '@atlas-gtm/lib';
import { InsightCategorySchema } from './handler-result';

// ===========================================
// Importance Level Schema
// ===========================================

/**
 * Importance levels for extracted insights.
 */
export const ImportanceLevelSchema = z.enum(['low', 'medium', 'high']);
export type ImportanceLevel = z.infer<typeof ImportanceLevelSchema>;

// ===========================================
// Overall Quality Schema
// ===========================================

/**
 * Quality assessment of the source for insight extraction.
 */
export const OverallQualitySchema = z.enum(['poor', 'fair', 'good', 'excellent']);
export type OverallQuality = z.infer<typeof OverallQualitySchema>;

// ===========================================
// Extracted Insight Item Schema
// ===========================================

/**
 * Single extracted insight with metadata.
 */
export const ExtractedInsightItemSchema = z.object({
  category: InsightCategorySchema.describe(
    'Insight category: buying_process (decision-makers, timeline), pain_point (problems mentioned), objection (reasons for hesitation), competitive_intel (tools they use), messaging_effectiveness (what resonated)'
  ),

  content: z
    .string()
    .min(10)
    .max(500)
    .describe('The insight content - a clear, actionable observation'),

  importance: ImportanceLevelSchema.describe(
    'Importance: low (nice to know), medium (useful for KB), high (critical learning)'
  ),

  actionable: z
    .boolean()
    .describe('True if this insight suggests a specific action should be taken'),

  action_suggestion: z
    .string()
    .max(200)
    .nullable()
    .describe('Suggested action if actionable (e.g., "Update objection handler for pricing")'),

  extracted_quote: z
    .string()
    .max(200)
    .nullable()
    .describe('Direct quote from the source that supports this insight'),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in the accuracy of this insight extraction'),
});

export type ExtractedInsightItem = z.infer<typeof ExtractedInsightItemSchema>;

// ===========================================
// Insight Extraction Schema
// ===========================================

/**
 * Claude's structured insight extraction result.
 *
 * Used by INSIGHT_TOOL for guaranteed schema-valid responses.
 */
export const InsightExtractionSchema = z.object({
  insights: z
    .array(ExtractedInsightItemSchema)
    .max(10)
    .describe('List of extracted insights (max 10 per source)'),

  overall_quality: OverallQualitySchema.describe(
    'Quality of the source for insight extraction: poor (little value), fair (some insights), good (valuable), excellent (highly informative)'
  ),

  extraction_notes: z
    .string()
    .max(300)
    .nullable()
    .describe('Notes about the extraction process or limitations'),
});

export type InsightExtraction = z.infer<typeof InsightExtractionSchema>;

// ===========================================
// Insight Tool Definition
// ===========================================

/**
 * Structured output tool for insight extraction.
 *
 * Usage:
 * ```typescript
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-haiku-latest',
 *   tools: [INSIGHT_TOOL.tool],
 *   tool_choice: forceToolChoice(INSIGHT_TOOL.name),
 *   messages: [{ role: 'user', content: insightPrompt }],
 * });
 *
 * const result = extractToolResult(response.content, INSIGHT_TOOL.name);
 * const extraction = INSIGHT_TOOL.parse(result);
 * ```
 */
export const INSIGHT_TOOL = buildTool({
  name: 'extract_insights',
  description:
    'Extract valuable insights from email replies or call transcripts for knowledge base learning. Returns structured insights with categories, importance levels, and actionability.',
  schema: InsightExtractionSchema,
});

// ===========================================
// Type Exports
// ===========================================

export type InsightToolInput = z.infer<typeof InsightExtractionSchema>;
