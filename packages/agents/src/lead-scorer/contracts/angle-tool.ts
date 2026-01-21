/**
 * Lead Scorer Angle Recommendation Tool
 *
 * Defines the structured output schema for Claude's messaging angle recommendations.
 * Used by ANGLE_TOOL for type-safe structured outputs.
 *
 * Implements: FR-001 (Lead Scorer MUST use buildTool with JSON Schema)
 *
 * @module lead-scorer/contracts/angle-tool
 */

import { z } from 'zod';
import { buildTool } from '@atlas-gtm/lib';
import { MessagingAngleSchema } from './scoring-result';

// ===========================================
// Angle Recommendation Schema
// ===========================================

/**
 * Claude's structured recommendation for messaging angle.
 *
 * Used by ANGLE_TOOL for guaranteed schema-valid responses.
 */
export const AngleRecommendationSchema = z.object({
  angle: MessagingAngleSchema.describe(
    'The recommended messaging angle from: technical, roi, compliance, speed, integration'
  ),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0'),

  reasoning: z
    .string()
    .min(1)
    .max(500)
    .describe('Brief explanation of why this angle fits the lead best'),

  personalization_hints: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(4)
    .describe('2-4 specific personalization suggestions for outreach'),
});

export type AngleRecommendation = z.infer<typeof AngleRecommendationSchema>;

// ===========================================
// Angle Tool Definition
// ===========================================

/**
 * Structured output tool for messaging angle recommendations.
 *
 * Usage:
 * ```typescript
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-haiku-latest',
 *   tools: [ANGLE_TOOL.tool],
 *   tool_choice: forceToolChoice(ANGLE_TOOL.name),
 *   messages: [{ role: 'user', content: anglePrompt }],
 * });
 *
 * const result = extractToolResult(response.content, ANGLE_TOOL.name);
 * const recommendation = ANGLE_TOOL.parse(result);
 * ```
 */
export const ANGLE_TOOL = buildTool({
  name: 'recommend_angle',
  description:
    'Analyze lead information and recommend the best messaging angle for sales outreach. Returns structured recommendation with confidence score and personalization hints.',
  schema: AngleRecommendationSchema,
});

// ===========================================
// Type Exports
// ===========================================

export type AngleToolInput = z.infer<typeof AngleRecommendationSchema>;
