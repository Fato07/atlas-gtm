/**
 * Score Calculation Unit Tests
 *
 * Tests for score normalization and tier assignment.
 */

import { describe, test, expect } from 'bun:test';
import {
  normalizeScore,
  calculateScore,
  assignTier,
  isOutboundReady,
  requiresReview,
  getTierPriority,
  getTierDescription,
  calculateScoreQuality,
  loadThresholds,
  validateThresholds,
} from '../../lead-scorer/scoring';
import { DEFAULT_TIER_THRESHOLDS } from '../../lead-scorer/contracts/scoring-result';
import type { RuleResult } from '../../lead-scorer/contracts/scoring-result';

// ===========================================
// Test Helpers
// ===========================================

function createRuleResults(scores: number[], maxScores: number[]): RuleResult[] {
  return scores.map((score, i) => ({
    rule_id: `rule_${i}`,
    attribute: `attr_${i}`,
    value: i,
    score,
    max_score: maxScores[i],
    reasoning: `Rule ${i} reasoning`,
  }));
}

// ===========================================
// normalizeScore
// ===========================================

describe('normalizeScore', () => {
  test('normalizes 50% score correctly', () => {
    const result = normalizeScore(50, 100);
    expect(result).toBe(50);
  });

  test('normalizes 100% score correctly', () => {
    const result = normalizeScore(100, 100);
    expect(result).toBe(100);
  });

  test('normalizes 0% score correctly', () => {
    const result = normalizeScore(0, 100);
    expect(result).toBe(0);
  });

  test('rounds to nearest integer', () => {
    const result = normalizeScore(33, 100);
    expect(result).toBe(33);

    const result2 = normalizeScore(33.6, 100);
    expect(result2).toBe(34);
  });

  test('caps at 100', () => {
    const result = normalizeScore(150, 100);
    expect(result).toBe(100);
  });

  test('floors at 0', () => {
    const result = normalizeScore(-10, 100);
    expect(result).toBe(0);
  });

  test('handles zero max possible', () => {
    const result = normalizeScore(50, 0);
    expect(result).toBe(0);
  });

  test('calculates partial scores correctly', () => {
    const result = normalizeScore(45, 75); // 60%
    expect(result).toBe(60);
  });
});

// ===========================================
// calculateScore
// ===========================================

describe('calculateScore', () => {
  test('calculates score from rule results', () => {
    const results = createRuleResults([20, 15, 10], [30, 20, 25]);
    const { score, rawScore, maxPossible, knockedOut } = calculateScore(results, null);

    expect(rawScore).toBe(45);
    expect(maxPossible).toBe(75);
    expect(score).toBe(60); // 45/75 = 60%
    expect(knockedOut).toBe(false);
  });

  test('returns 0 when knockout rule failed', () => {
    const results = createRuleResults([20, 15, 10], [30, 20, 25]);
    const { score, rawScore, knockedOut } = calculateScore(results, 'knockout_rule_id');

    expect(score).toBe(0);
    expect(rawScore).toBe(0);
    expect(knockedOut).toBe(true);
  });

  test('handles empty results', () => {
    const { score, rawScore, maxPossible } = calculateScore([], null);

    expect(score).toBe(0);
    expect(rawScore).toBe(0);
    expect(maxPossible).toBe(0);
  });

  test('handles all-zero scores', () => {
    const results = createRuleResults([0, 0, 0], [30, 20, 25]);
    const { score, rawScore, maxPossible } = calculateScore(results, null);

    expect(score).toBe(0);
    expect(rawScore).toBe(0);
    expect(maxPossible).toBe(75);
  });
});

// ===========================================
// assignTier
// ===========================================

describe('assignTier', () => {
  test('assigns priority tier for high scores', () => {
    expect(assignTier(70, false)).toBe('priority');
    expect(assignTier(85, false)).toBe('priority');
    expect(assignTier(100, false)).toBe('priority');
  });

  test('assigns qualified tier for medium scores', () => {
    expect(assignTier(50, false)).toBe('qualified');
    expect(assignTier(60, false)).toBe('qualified');
    expect(assignTier(69, false)).toBe('qualified');
  });

  test('assigns nurture tier for low scores', () => {
    expect(assignTier(30, false)).toBe('nurture');
    expect(assignTier(40, false)).toBe('nurture');
    expect(assignTier(49, false)).toBe('nurture');
  });

  test('assigns disqualified tier for very low scores', () => {
    expect(assignTier(0, false)).toBe('disqualified');
    expect(assignTier(15, false)).toBe('disqualified');
    expect(assignTier(29, false)).toBe('disqualified');
  });

  test('assigns disqualified when knocked out regardless of score', () => {
    expect(assignTier(100, true)).toBe('disqualified');
    expect(assignTier(70, true)).toBe('disqualified');
    expect(assignTier(50, true)).toBe('disqualified');
  });

  test('uses custom thresholds', () => {
    const customThresholds = { high: 80, low: 60 };

    expect(assignTier(79, false, customThresholds)).toBe('qualified');
    expect(assignTier(80, false, customThresholds)).toBe('priority');
    expect(assignTier(59, false, customThresholds)).toBe('nurture');
    expect(assignTier(60, false, customThresholds)).toBe('qualified');
  });
});

// ===========================================
// Tier Helpers
// ===========================================

describe('isOutboundReady', () => {
  test('returns true for priority tier', () => {
    expect(isOutboundReady('priority')).toBe(true);
  });

  test('returns true for qualified tier', () => {
    expect(isOutboundReady('qualified')).toBe(true);
  });

  test('returns false for nurture tier', () => {
    expect(isOutboundReady('nurture')).toBe(false);
  });

  test('returns false for disqualified tier', () => {
    expect(isOutboundReady('disqualified')).toBe(false);
  });
});

describe('requiresReview', () => {
  test('returns true for qualified tier', () => {
    expect(requiresReview('qualified')).toBe(true);
  });

  test('returns false for other tiers', () => {
    expect(requiresReview('priority')).toBe(false);
    expect(requiresReview('nurture')).toBe(false);
    expect(requiresReview('disqualified')).toBe(false);
  });
});

describe('getTierPriority', () => {
  test('returns correct priority order', () => {
    expect(getTierPriority('priority')).toBe(1);
    expect(getTierPriority('qualified')).toBe(2);
    expect(getTierPriority('nurture')).toBe(3);
    expect(getTierPriority('disqualified')).toBe(4);
  });

  test('priority tier has lowest number (highest priority)', () => {
    expect(getTierPriority('priority')).toBeLessThan(getTierPriority('qualified'));
    expect(getTierPriority('qualified')).toBeLessThan(getTierPriority('nurture'));
    expect(getTierPriority('nurture')).toBeLessThan(getTierPriority('disqualified'));
  });
});

describe('getTierDescription', () => {
  test('returns descriptions for all tiers', () => {
    expect(getTierDescription('priority')).toContain('High-value');
    expect(getTierDescription('qualified')).toContain('Medium-value');
    expect(getTierDescription('nurture')).toContain('Low-value');
    expect(getTierDescription('disqualified')).toContain('Does not meet');
  });
});

// ===========================================
// Score Quality
// ===========================================

describe('calculateScoreQuality', () => {
  test('calculates high confidence for many matches', () => {
    const results = createRuleResults([20, 15, 10, 8, 5], [20, 15, 10, 8, 5]);
    const quality = calculateScoreQuality(results, 58, 58);

    expect(quality.rulesMatched).toBe(5);
    expect(quality.confidence).toBe('high');
  });

  test('calculates medium confidence for some matches', () => {
    const results = createRuleResults([20, 15, 0, 0, 0], [20, 20, 20, 20, 20]);
    const quality = calculateScoreQuality(results, 35, 100);

    expect(quality.rulesMatched).toBe(2);
    expect(quality.confidence).toBe('medium');
  });

  test('calculates low confidence for few matches', () => {
    const results = createRuleResults([10, 0, 0, 0, 0], [20, 20, 20, 20, 20]);
    const quality = calculateScoreQuality(results, 10, 100);

    expect(quality.rulesMatched).toBe(1);
    expect(quality.confidence).toBe('low');
  });

  test('calculates achievement rate correctly', () => {
    const results = createRuleResults([30, 20], [30, 20]);
    const quality = calculateScoreQuality(results, 100, 50);

    expect(quality.achievementRate).toBe(1); // 100% score
  });
});

// ===========================================
// Threshold Helpers
// ===========================================

describe('loadThresholds', () => {
  test('returns defaults when no config provided', () => {
    const thresholds = loadThresholds();

    expect(thresholds).toEqual(DEFAULT_TIER_THRESHOLDS);
  });

  test('returns defaults when config is empty', () => {
    const thresholds = loadThresholds({});

    expect(thresholds).toEqual(DEFAULT_TIER_THRESHOLDS);
  });

  test('uses config thresholds when provided', () => {
    const thresholds = loadThresholds({
      default_tier_thresholds: { high: 80, low: 60 },
    });

    expect(thresholds).toEqual({ high: 80, low: 60 });
  });

  test('uses defaults for missing threshold values', () => {
    const thresholds = loadThresholds({
      default_tier_thresholds: { high: 80 },
    });

    expect(thresholds.high).toBe(80);
    expect(thresholds.low).toBe(DEFAULT_TIER_THRESHOLDS.low);
  });
});

describe('validateThresholds', () => {
  test('validates correct thresholds', () => {
    expect(validateThresholds({ high: 70, low: 50 })).toBe(true);
    expect(validateThresholds({ high: 80, low: 60 })).toBe(true);
    expect(validateThresholds({ high: 100, low: 30 })).toBe(true);
  });

  test('rejects thresholds where high <= low', () => {
    expect(validateThresholds({ high: 50, low: 50 })).toBe(false);
    expect(validateThresholds({ high: 40, low: 60 })).toBe(false);
  });

  test('rejects thresholds outside 0-100 range', () => {
    expect(validateThresholds({ high: 110, low: 50 })).toBe(false);
    expect(validateThresholds({ high: 70, low: -10 })).toBe(false);
  });

  test('rejects low threshold below nurture threshold (30)', () => {
    expect(validateThresholds({ high: 70, low: 25 })).toBe(false);
  });
});
