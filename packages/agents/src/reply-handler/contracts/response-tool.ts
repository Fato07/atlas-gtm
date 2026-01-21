/**
 * Reply Handler Response Generation Tool
 *
 * Defines the structured output schema for Claude's personalized responses.
 * Used by RESPONSE_TOOL for type-safe structured outputs.
 *
 * Implements: FR-003 (Reply Handler responder MUST use buildTool)
 *
 * @module reply-handler/contracts/response-tool
 */

import { z } from 'zod';
import { buildTool } from '@atlas-gtm/lib';

// ===========================================
// Response Tone Schema
// ===========================================

/**
 * Available tones for generated responses.
 */
export const ResponseToneSchema = z.enum([
  'formal',
  'friendly',
  'urgent',
  'apologetic',
  'neutral',
]);

export type ResponseTone = z.infer<typeof ResponseToneSchema>;

// ===========================================
// Personalized Response Schema
// ===========================================

/**
 * Claude's structured personalized response.
 *
 * Used by RESPONSE_TOOL for guaranteed schema-valid responses.
 */
export const PersonalizedResponseSchema = z.object({
  response_text: z
    .string()
    .min(10)
    .max(2000)
    .describe('The personalized reply text, ready to send'),

  template_used: z
    .string()
    .nullable()
    .describe('Template ID if a KB template was used as the base, null if generated from scratch'),

  personalization_applied: z
    .array(z.string().max(100))
    .describe('List of personalizations applied (e.g., "Added company name", "Referenced their tech stack")'),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that this response is appropriate for the context'),

  tone: ResponseToneSchema.describe(
    'Tone of the generated response: formal, friendly, urgent, apologetic, or neutral'
  ),

  call_to_action: z
    .string()
    .max(200)
    .nullable()
    .describe('Primary call-to-action in the response (e.g., "Schedule a call", "Reply with availability")'),
});

export type PersonalizedResponse = z.infer<typeof PersonalizedResponseSchema>;

// ===========================================
// Response Tool Definition
// ===========================================

/**
 * Structured output tool for personalized response generation.
 *
 * Usage:
 * ```typescript
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-haiku-latest',
 *   tools: [RESPONSE_TOOL.tool],
 *   tool_choice: forceToolChoice(RESPONSE_TOOL.name),
 *   messages: [{ role: 'user', content: responsePrompt }],
 * });
 *
 * const result = extractToolResult(response.content, RESPONSE_TOOL.name);
 * const personalizedResponse = RESPONSE_TOOL.parse(result);
 * ```
 */
export const RESPONSE_TOOL = buildTool({
  name: 'generate_response',
  description:
    'Generate a personalized reply based on the classification, KB templates, and lead context. Returns the response text with metadata about personalizations applied.',
  schema: PersonalizedResponseSchema,
});

// ===========================================
// Type Exports
// ===========================================

export type ResponseToolInput = z.infer<typeof PersonalizedResponseSchema>;
