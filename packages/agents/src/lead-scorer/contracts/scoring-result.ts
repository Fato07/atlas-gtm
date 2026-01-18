/**
 * Scoring Result Contract
 *
 * Defines the output schema for lead scoring.
 * This contract is used by:
 * - Lead Scorer Agent (producer)
 * - n8n workflow (consumer)
 * - Airtable field mapping
 *
 * @module contracts/scoring-result
 */

import { z } from 'zod';

// ===========================================
// Enums
// ===========================================

export const ScoringTierSchema = z.enum([
  'priority',      // High-value leads, auto-queue for outbound
  'qualified',     // Medium-value leads, send to Slack for review
  'nurture',       // Low-value leads, deprioritize
  'disqualified',  // Rejected leads (knockout rule failed or score <30)
]);

export type ScoringTier = z.infer<typeof ScoringTierSchema>;

export const MessagingAngleSchema = z.enum([
  'technical',    // Lead with product capabilities and automation
  'roi',          // Lead with cost savings and efficiency
  'compliance',   // Lead with regulatory and reporting requirements
  'speed',        // Lead with implementation speed and quick wins
  'integration',  // Lead with ecosystem compatibility
]);

export type MessagingAngle = z.infer<typeof MessagingAngleSchema>;

// ===========================================
// Rule Result Schema
// ===========================================

export const RuleResultSchema = z.object({
  rule_id: z
    .string()
    .describe('ICP rule identifier'),

  attribute: z
    .string()
    .describe('Lead attribute evaluated (e.g., company_size)'),

  value: z
    .unknown()
    .describe('The lead value for this attribute'),

  score: z
    .number()
    .min(0)
    .describe('Points awarded (0 to max_score)'),

  max_score: z
    .number()
    .min(0)
    .describe('Maximum possible points for this rule'),

  reasoning: z
    .string()
    .describe('Human-readable explanation of the score'),

  is_knockout: z
    .boolean()
    .optional()
    .describe('True if this was a knockout rule that failed'),
});

export type RuleResult = z.infer<typeof RuleResultSchema>;

// ===========================================
// Scoring Result Schema
// ===========================================

export const ScoringResultSchema = z.object({
  // === Core Output ===
  lead_id: z
    .string()
    .min(1)
    .describe('Lead identifier from input'),

  score: z
    .number()
    .min(0)
    .max(100)
    .describe('Normalized score (0-100)'),

  tier: ScoringTierSchema
    .describe('Tier assignment based on score thresholds'),

  // === Scoring Breakdown ===
  scoring_breakdown: z
    .array(RuleResultSchema)
    .describe('Individual rule evaluation results'),

  // === Recommendations ===
  recommended_angle: MessagingAngleSchema
    .describe('Best messaging approach for this lead'),

  recommended_sequence: z
    .string()
    .optional()
    .describe('Campaign sequence ID for outbound'),

  personalization_hints: z
    .array(z.string())
    .describe('Specific personalization suggestions'),

  // === Metadata ===
  vertical_detected: z
    .string()
    .describe('Vertical detected or provided'),

  brain_used: z
    .string()
    .describe('Brain ID used for scoring'),

  knockout_failed: z
    .string()
    .optional()
    .describe('Rule ID if rejected due to knockout rule'),

  // === Audit Trail ===
  processing_time_ms: z
    .number()
    .nonnegative()
    .describe('Total processing time in milliseconds'),

  rules_evaluated: z
    .number()
    .nonnegative()
    .describe('Number of rules evaluated'),

  timestamp: z
    .string()
    .datetime()
    .describe('ISO 8601 timestamp of scoring'),
});

export type ScoringResult = z.infer<typeof ScoringResultSchema>;

// ===========================================
// Tier Thresholds
// ===========================================

/**
 * Default tier thresholds (from brain.config.default_tier_thresholds)
 */
export interface TierThresholds {
  high: number;  // Score >= this is 'priority' (default: 70)
  low: number;   // Score >= this is 'qualified' (default: 50)
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  high: 70,
  low: 50,
};

/**
 * Calculate tier from score using thresholds
 */
export function calculateTier(
  score: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): ScoringTier {
  if (score >= thresholds.high) return 'priority';
  if (score >= thresholds.low) return 'qualified';
  if (score >= 30) return 'nurture';
  return 'disqualified';
}

// ===========================================
// Validation Helpers
// ===========================================

/**
 * Validate a scoring result object
 * @throws ZodError if validation fails
 */
export function validateScoringResult(result: unknown): ScoringResult {
  return ScoringResultSchema.parse(result);
}

/**
 * Safely validate a scoring result, returning null on failure
 */
export function safeValidateScoringResult(result: unknown): ScoringResult | null {
  const parseResult = ScoringResultSchema.safeParse(result);
  return parseResult.success ? parseResult.data : null;
}

// ===========================================
// Airtable Field Mapping
// ===========================================

/**
 * Map ScoringResult to Airtable field updates
 */
export interface AirtableScoreUpdate {
  icp_score: number;
  icp_tier: ScoringTier;
  icp_angle: MessagingAngle;
  icp_breakdown: string;        // JSON stringified
  icp_scored_at: string;        // ISO 8601
  icp_brain_used: string;
  outbound_ready: boolean;
}

/**
 * Convert ScoringResult to Airtable update format
 */
export function toAirtableUpdate(result: ScoringResult): AirtableScoreUpdate {
  return {
    icp_score: result.score,
    icp_tier: result.tier,
    icp_angle: result.recommended_angle,
    icp_breakdown: JSON.stringify(result.scoring_breakdown),
    icp_scored_at: result.timestamp,
    icp_brain_used: result.brain_used,
    outbound_ready: result.tier === 'priority' || result.tier === 'qualified',
  };
}

// ===========================================
// Slack Notification Helpers
// ===========================================

/**
 * Check if result should trigger Slack notification
 * Per spec: Tier 2 (qualified) leads go to Slack for review
 */
export function shouldNotifySlack(result: ScoringResult): boolean {
  return result.tier === 'qualified';
}

/**
 * Get top N scoring signals for Slack message
 */
export function getTopSignals(result: ScoringResult, n: number = 3): RuleResult[] {
  return [...result.scoring_breakdown]
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/**
 * Format scoring result for Slack notification
 */
export function formatSlackMessage(result: ScoringResult): string {
  const topSignals = getTopSignals(result, 3);

  return `*Lead Review Needed*

*Lead ID*: ${result.lead_id}
*Score*: ${result.score}/100 (${result.tier})

*Top Signals*:
${topSignals.map((s) => `• ${s.attribute}: ${JSON.stringify(s.value)} (+${s.score}/${s.max_score})`).join('\n')}

*Recommended Angle*: ${result.recommended_angle}
${result.personalization_hints.length > 0 ? `*Hints*: ${result.personalization_hints.join(', ')}` : ''}

[Approve] [Reject] [Adjust Score]`;
}
