/**
 * Score Calculation Module
 *
 * Calculates normalized scores and tier assignments
 * based on rule evaluation results and brain thresholds.
 *
 * @module lead-scorer/scoring
 */

import type { ScoringTier } from '@atlas-gtm/lib';
import type { RuleResult, TierThresholds } from './contracts/scoring-result';
import { DEFAULT_TIER_THRESHOLDS } from './contracts/scoring-result';
import { sumRuleScores, sumMaxScores } from './rules';

// ===========================================
// Score Calculation
// ===========================================

/**
 * Normalize a raw score to 0-100 scale
 */
export function normalizeScore(rawScore: number, maxPossible: number): number {
  if (maxPossible === 0) return 0;

  const normalized = (rawScore / maxPossible) * 100;
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

/**
 * Calculate final score from rule results
 * Handles knockout rules and normalization
 */
export function calculateScore(
  results: RuleResult[],
  knockoutFailed: string | null
): {
  score: number;
  rawScore: number;
  maxPossible: number;
  knockedOut: boolean;
} {
  // If knockout rule failed, score is 0
  if (knockoutFailed) {
    const maxPossible = sumMaxScores(results);
    return {
      score: 0,
      rawScore: 0,
      maxPossible,
      knockedOut: true,
    };
  }

  const rawScore = sumRuleScores(results);
  const maxPossible = sumMaxScores(results);
  const score = normalizeScore(rawScore, maxPossible);

  return {
    score,
    rawScore,
    maxPossible,
    knockedOut: false,
  };
}

// ===========================================
// Tier Assignment
// ===========================================

/**
 * Assign tier based on score and thresholds
 * Per spec:
 * - priority: score >= high (default 70)
 * - qualified: score >= low (default 50)
 * - nurture: score >= 30
 * - disqualified: score < 30 or knockout failed
 */
export function assignTier(
  score: number,
  knockedOut: boolean,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): ScoringTier {
  // Knockout rule failed -> disqualified regardless of score
  if (knockedOut) {
    return 'disqualified';
  }

  // Score-based tier assignment
  if (score >= thresholds.high) {
    return 'priority';
  }
  if (score >= thresholds.low) {
    return 'qualified';
  }
  if (score >= 30) {
    return 'nurture';
  }
  return 'disqualified';
}

// ===========================================
// Tier Helpers
// ===========================================

/**
 * Check if tier qualifies for outbound sequences
 */
export function isOutboundReady(tier: ScoringTier): boolean {
  return tier === 'priority' || tier === 'qualified';
}

/**
 * Check if tier requires manual review
 */
export function requiresReview(tier: ScoringTier): boolean {
  return tier === 'qualified';
}

/**
 * Get tier priority for sorting (lower = higher priority)
 */
export function getTierPriority(tier: ScoringTier): number {
  switch (tier) {
    case 'priority':
      return 1;
    case 'qualified':
      return 2;
    case 'nurture':
      return 3;
    case 'disqualified':
      return 4;
  }
}

/**
 * Get human-readable tier description
 */
export function getTierDescription(tier: ScoringTier): string {
  switch (tier) {
    case 'priority':
      return 'High-value lead, auto-queue for outbound sequences';
    case 'qualified':
      return 'Medium-value lead, send to Slack for manual review';
    case 'nurture':
      return 'Low-value lead, add to nurture campaign';
    case 'disqualified':
      return 'Does not meet ICP criteria, skip outreach';
  }
}

// ===========================================
// Score Distribution Analysis
// ===========================================

/**
 * Score quality metrics
 */
export interface ScoreQuality {
  /** Percentage of max possible score achieved */
  achievementRate: number;

  /** Number of rules that matched (score > 0) */
  rulesMatched: number;

  /** Number of rules evaluated */
  totalRules: number;

  /** Confidence in score (higher = more rules matched) */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate score quality metrics
 */
export function calculateScoreQuality(
  results: RuleResult[],
  score: number,
  maxPossible: number
): ScoreQuality {
  const rulesMatched = results.filter((r) => r.score > 0).length;
  const totalRules = results.length;
  const achievementRate = maxPossible > 0 ? score / 100 : 0;

  // Confidence based on rules matched
  let confidence: 'high' | 'medium' | 'low';
  if (rulesMatched >= 5 || (totalRules > 0 && rulesMatched / totalRules >= 0.7)) {
    confidence = 'high';
  } else if (rulesMatched >= 3 || (totalRules > 0 && rulesMatched / totalRules >= 0.4)) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    achievementRate,
    rulesMatched,
    totalRules,
    confidence,
  };
}

// ===========================================
// Threshold Helpers
// ===========================================

/**
 * Load thresholds from brain config or use defaults
 */
export function loadThresholds(
  brainConfig?: { default_tier_thresholds?: { high?: number; low?: number } }
): TierThresholds {
  if (!brainConfig?.default_tier_thresholds) {
    return DEFAULT_TIER_THRESHOLDS;
  }

  return {
    high: brainConfig.default_tier_thresholds.high ?? DEFAULT_TIER_THRESHOLDS.high,
    low: brainConfig.default_tier_thresholds.low ?? DEFAULT_TIER_THRESHOLDS.low,
  };
}

/**
 * Validate tier thresholds are sensible
 */
export function validateThresholds(thresholds: TierThresholds): boolean {
  return (
    thresholds.high > thresholds.low &&
    thresholds.high <= 100 &&
    thresholds.high >= 0 &&
    thresholds.low <= 100 &&
    thresholds.low >= 0 &&
    thresholds.low >= 30 // Must be above nurture threshold
  );
}
