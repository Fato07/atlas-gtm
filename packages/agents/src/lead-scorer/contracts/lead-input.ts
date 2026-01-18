/**
 * Lead Input Contract
 *
 * Defines the input schema for lead scoring.
 * This contract is used by:
 * - n8n workflow (sender)
 * - Lead Scorer Agent (receiver)
 *
 * @module contracts/lead-input
 */

import { z } from 'zod';

// ===========================================
// Enums
// ===========================================

export const FundingStageSchema = z.enum([
  'pre_seed',
  'seed',
  'series_a',
  'series_b',
  'series_c',
  'series_d_plus',
  'public',
  'bootstrapped',
]);

export type FundingStage = z.infer<typeof FundingStageSchema>;

export const LeadSourceSchema = z.enum([
  'clay',
  'linkedin',
  'referral',
  'website',
  'conference',
  'cold_outbound',
  'inbound',
  'partner',
]);

export type LeadSource = z.infer<typeof LeadSourceSchema>;

// ===========================================
// Lead Input Schema
// ===========================================

export const LeadInputSchema = z.object({
  // === Required Fields ===
  lead_id: z
    .string()
    .min(1, 'lead_id is required')
    .describe('Unique identifier for the lead'),

  email: z
    .string()
    .email('Invalid email format')
    .describe('Lead email address'),

  company: z
    .string()
    .min(1, 'company is required')
    .describe('Company name'),

  source: LeadSourceSchema
    .describe('How the lead was acquired'),

  // === Lead Profile (optional) ===
  first_name: z
    .string()
    .optional()
    .describe('Lead first name'),

  last_name: z
    .string()
    .optional()
    .describe('Lead last name'),

  title: z
    .string()
    .optional()
    .describe('Job title'),

  linkedin_url: z
    .string()
    .url()
    .optional()
    .describe('LinkedIn profile URL'),

  // === Company Profile (optional) ===
  company_size: z
    .number()
    .positive('company_size must be positive')
    .optional()
    .describe('Number of employees'),

  industry: z
    .string()
    .optional()
    .describe('Industry classification'),

  vertical: z
    .string()
    .optional()
    .describe('Explicit vertical for brain selection (if known)'),

  sub_vertical: z
    .string()
    .optional()
    .describe('Sub-vertical for more specific targeting'),

  // === Firmographic (optional) ===
  revenue: z
    .number()
    .nonnegative('revenue must be non-negative')
    .optional()
    .describe('Annual revenue in USD'),

  funding_stage: FundingStageSchema
    .optional()
    .describe('Company funding stage'),

  funding_amount: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total funding raised in USD'),

  founded_year: z
    .number()
    .min(1900)
    .max(new Date().getFullYear())
    .optional()
    .describe('Year company was founded'),

  location: z
    .string()
    .optional()
    .describe('Company headquarters location'),

  country: z
    .string()
    .optional()
    .describe('Country code (ISO 3166-1 alpha-2)'),

  // === Technographic (optional) ===
  tech_stack: z
    .array(z.string())
    .optional()
    .describe('Technologies used by the company'),

  tools: z
    .array(z.string())
    .optional()
    .describe('Specific tools (Salesforce, Slack, etc.)'),

  // === Behavioral Signals (optional) ===
  hiring_signals: z
    .array(z.string())
    .optional()
    .describe('Recent job postings'),

  recent_news: z
    .array(z.string())
    .optional()
    .describe('Company news items'),

  growth_signals: z
    .array(z.string())
    .optional()
    .describe('Expansion indicators'),

  // === Source Tracking (optional) ===
  campaign_id: z
    .string()
    .optional()
    .describe('Marketing campaign identifier'),

  batch_id: z
    .string()
    .optional()
    .describe('Batch processing identifier'),

  // === Enrichment Data (optional) ===
  enrichment_data: z
    .record(z.unknown())
    .optional()
    .describe('Additional enrichment data from third-party sources'),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;

// ===========================================
// Validation Helpers
// ===========================================

/**
 * Validate a lead input object
 * @throws ZodError if validation fails
 */
export function validateLeadInput(input: unknown): LeadInput {
  return LeadInputSchema.parse(input);
}

/**
 * Safely validate a lead input, returning null on failure
 */
export function safeValidateLeadInput(input: unknown): LeadInput | null {
  const result = LeadInputSchema.safeParse(input);
  return result.success ? result.data : null;
}

/**
 * Get validation errors for a lead input
 */
export function getLeadInputErrors(input: unknown): string[] {
  const result = LeadInputSchema.safeParse(input);
  if (result.success) return [];

  return result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  );
}

// ===========================================
// Missing Fields Detection
// ===========================================

/**
 * Required fields that must have values for scoring
 */
export const REQUIRED_SCORING_FIELDS = [
  'lead_id',
  'email',
  'company',
  'source',
] as const;

/**
 * Important optional fields that improve scoring quality
 */
export const IMPORTANT_OPTIONAL_FIELDS = [
  'company_size',
  'industry',
  'title',
  'funding_stage',
  'tech_stack',
] as const;

/**
 * Count missing important fields
 */
export function countMissingFields(lead: LeadInput): number {
  return IMPORTANT_OPTIONAL_FIELDS.filter(
    (field) => lead[field] === undefined || lead[field] === null
  ).length;
}

/**
 * Check if lead needs enrichment (>3 missing important fields)
 */
export function needsEnrichment(lead: LeadInput): boolean {
  return countMissingFields(lead) > 3;
}
