/**
 * Reply Handler Classification Tool
 *
 * Defines the structured output schema for Claude's reply classification.
 * Used by CLASSIFICATION_TOOL for type-safe structured outputs.
 *
 * Implements: FR-002 (Reply Handler classifier MUST use buildTool)
 *
 * @module reply-handler/contracts/classification-tool
 */

import { z } from 'zod';
import { buildTool } from '@atlas-gtm/lib';
import { IntentSchema, ComplexitySchema, UrgencySchema } from './handler-result';

// ===========================================
// Classification Result Schema
// ===========================================

/**
 * Claude's structured classification of a reply.
 *
 * Used by CLASSIFICATION_TOOL for guaranteed schema-valid responses.
 */
export const ClassificationResultSchema = z.object({
  intent: IntentSchema.describe(
    'Primary intent: positive_interest, question, objection, referral, unsubscribe, not_interested, out_of_office, bounce, unclear'
  ),

  intent_confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in intent classification between 0.0 and 1.0'),

  intent_reasoning: z
    .string()
    .min(1)
    .max(500)
    .describe('Explanation of why this intent was chosen, citing specific phrases or patterns from the reply'),

  sentiment: z
    .number()
    .min(-1)
    .max(1)
    .describe('Sentiment score: -1 (very negative) to +1 (very positive), 0 is neutral'),

  complexity: ComplexitySchema.describe(
    'Response complexity: simple (straightforward reply), medium (requires some context), complex (multi-part or nuanced response needed)'
  ),

  urgency: UrgencySchema.describe(
    'Response urgency: low (can wait), medium (respond soon), high (time-sensitive)'
  ),

  reply_type: z
    .string()
    .min(1)
    .max(100)
    .describe('Specific reply type for KB matching (e.g., "pricing_question", "competitor_objection", "meeting_request")'),

  key_phrases: z
    .array(z.string().max(100))
    .max(5)
    .optional()
    .describe('Important phrases from the reply that informed the classification'),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ===========================================
// Classification Tool Definition
// ===========================================

/**
 * Structured output tool for reply classification.
 *
 * Usage:
 * ```typescript
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-haiku-latest',
 *   tools: [CLASSIFICATION_TOOL.tool],
 *   tool_choice: forceToolChoice(CLASSIFICATION_TOOL.name),
 *   messages: [{ role: 'user', content: classificationPrompt }],
 * });
 *
 * const result = extractToolResult(response.content, CLASSIFICATION_TOOL.name);
 * const classification = CLASSIFICATION_TOOL.parse(result);
 * ```
 */
export const CLASSIFICATION_TOOL = buildTool({
  name: 'classify_reply',
  description:
    'Analyze an email reply to classify its intent, sentiment, complexity, and urgency. Returns structured classification for routing and response generation.',
  schema: ClassificationResultSchema,
});

// ===========================================
// Type Exports
// ===========================================

export type ClassificationToolInput = z.infer<typeof ClassificationResultSchema>;
