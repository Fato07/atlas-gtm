/**
 * Slack Notification Tests
 *
 * Tests for Slack notification helper functions including:
 * - shouldNotifySlack for tier filtering
 * - getTopSignals for signal extraction
 * - formatSlackMessage for message formatting
 *
 * @module __tests__/lead-scorer/slack.test
 */

import { describe, it, expect } from 'vitest';
import {
  shouldNotifySlack,
  getTopSignals,
  formatSlackMessage,
} from '../../lead-scorer/contracts/scoring-result';
import type { ScoringResult, RuleResult } from '../../lead-scorer/contracts/scoring-result';

// ===========================================
// Test Fixtures
// ===========================================

function createRuleResult(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    rule_id: 'rule_001',
    attribute: 'company_size',
    value: 150,
    score: 20,
    max_score: 30,
    reasoning: 'Company size in target range',
    ...overrides,
  };
}

function createScoringResult(
  overrides: Partial<ScoringResult> = {}
): ScoringResult {
  return {
    lead_id: 'lead_test_001',
    score: 65,
    tier: 'qualified',
    scoring_breakdown: [
      createRuleResult({ rule_id: 'rule_001', attribute: 'company_size', score: 25, max_score: 30 }),
      createRuleResult({ rule_id: 'rule_002', attribute: 'industry', score: 15, max_score: 20 }),
      createRuleResult({ rule_id: 'rule_003', attribute: 'title', score: 20, max_score: 25 }),
      createRuleResult({ rule_id: 'rule_004', attribute: 'tech_stack', score: 5, max_score: 15 }),
    ],
    recommended_angle: 'technical',
    personalization_hints: ['Mention AI automation', 'Reference their growth'],
    vertical_detected: 'saas',
    brain_used: 'brain_saas_v1',
    processing_time_ms: 150,
    rules_evaluated: 4,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ===========================================
// shouldNotifySlack Tests
// ===========================================

describe('shouldNotifySlack', () => {
  it('should return true for qualified tier', () => {
    const result = createScoringResult({ tier: 'qualified' });
    expect(shouldNotifySlack(result)).toBe(true);
  });

  it('should return false for priority tier', () => {
    const result = createScoringResult({ tier: 'priority' });
    expect(shouldNotifySlack(result)).toBe(false);
  });

  it('should return false for nurture tier', () => {
    const result = createScoringResult({ tier: 'nurture' });
    expect(shouldNotifySlack(result)).toBe(false);
  });

  it('should return false for disqualified tier', () => {
    const result = createScoringResult({ tier: 'disqualified' });
    expect(shouldNotifySlack(result)).toBe(false);
  });
});

// ===========================================
// getTopSignals Tests
// ===========================================

describe('getTopSignals', () => {
  it('should return top 3 signals by default', () => {
    const result = createScoringResult();
    const topSignals = getTopSignals(result);

    expect(topSignals).toHaveLength(3);
    // Should be sorted by score descending
    expect(topSignals[0].score).toBeGreaterThanOrEqual(topSignals[1].score);
    expect(topSignals[1].score).toBeGreaterThanOrEqual(topSignals[2].score);
  });

  it('should return specified number of signals', () => {
    const result = createScoringResult();

    expect(getTopSignals(result, 1)).toHaveLength(1);
    expect(getTopSignals(result, 2)).toHaveLength(2);
    expect(getTopSignals(result, 4)).toHaveLength(4);
  });

  it('should handle fewer signals than requested', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ score: 10 }),
        createRuleResult({ score: 20 }),
      ],
    });

    const topSignals = getTopSignals(result, 5);
    expect(topSignals).toHaveLength(2);
  });

  it('should handle empty breakdown', () => {
    const result = createScoringResult({ scoring_breakdown: [] });
    const topSignals = getTopSignals(result);
    expect(topSignals).toHaveLength(0);
  });

  it('should sort signals by score descending', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ rule_id: 'low', score: 5 }),
        createRuleResult({ rule_id: 'high', score: 25 }),
        createRuleResult({ rule_id: 'mid', score: 15 }),
      ],
    });

    const topSignals = getTopSignals(result, 3);
    expect(topSignals[0].rule_id).toBe('high');
    expect(topSignals[1].rule_id).toBe('mid');
    expect(topSignals[2].rule_id).toBe('low');
  });

  it('should not mutate original scoring_breakdown', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ rule_id: 'first', score: 5 }),
        createRuleResult({ rule_id: 'second', score: 25 }),
      ],
    });

    getTopSignals(result, 2);

    // Original order should be preserved
    expect(result.scoring_breakdown[0].rule_id).toBe('first');
    expect(result.scoring_breakdown[1].rule_id).toBe('second');
  });
});

// ===========================================
// formatSlackMessage Tests
// ===========================================

describe('formatSlackMessage', () => {
  it('should include lead ID', () => {
    const result = createScoringResult({ lead_id: 'lead_special_123' });
    const message = formatSlackMessage(result);
    expect(message).toContain('lead_special_123');
  });

  it('should include score and tier', () => {
    const result = createScoringResult({ score: 75, tier: 'qualified' });
    const message = formatSlackMessage(result);
    expect(message).toContain('75/100');
    expect(message).toContain('qualified');
  });

  it('should include top signals', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ attribute: 'company_size', value: 150, score: 25, max_score: 30 }),
        createRuleResult({ attribute: 'industry', value: 'SaaS', score: 15, max_score: 20 }),
      ],
    });
    const message = formatSlackMessage(result);

    expect(message).toContain('company_size');
    expect(message).toContain('industry');
  });

  it('should include recommended angle', () => {
    const result = createScoringResult({ recommended_angle: 'roi' });
    const message = formatSlackMessage(result);
    expect(message).toContain('roi');
  });

  it('should include personalization hints when present', () => {
    const result = createScoringResult({
      personalization_hints: ['Mention automation', 'Reference growth'],
    });
    const message = formatSlackMessage(result);
    expect(message).toContain('Mention automation');
    expect(message).toContain('Reference growth');
  });

  it('should handle empty personalization hints', () => {
    const result = createScoringResult({ personalization_hints: [] });
    const message = formatSlackMessage(result);
    // Should not throw, should still have core content
    expect(message).toContain('Lead Review Needed');
    expect(message).toContain(result.lead_id);
  });

  it('should include action buttons text', () => {
    const result = createScoringResult();
    const message = formatSlackMessage(result);
    expect(message).toContain('Approve');
    expect(message).toContain('Reject');
    expect(message).toContain('Adjust Score');
  });

  it('should format signal scores correctly', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ attribute: 'test_attr', score: 15, max_score: 20 }),
      ],
    });
    const message = formatSlackMessage(result);
    expect(message).toContain('+15/20');
  });

  it('should handle complex signal values', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({
          attribute: 'tech_stack',
          value: ['React', 'Node.js', 'PostgreSQL'],
          score: 20,
          max_score: 25,
        }),
      ],
    });
    const message = formatSlackMessage(result);
    expect(message).toContain('tech_stack');
    expect(message).toContain('React');
  });
});

// ===========================================
// Integration Tests
// ===========================================

describe('Slack Notification Integration', () => {
  it('should correctly identify qualified leads for Slack notification', () => {
    const qualifiedLead = createScoringResult({ score: 55, tier: 'qualified' });
    const hotLead = createScoringResult({ score: 85, tier: 'priority' });
    const nurtureLead = createScoringResult({ score: 35, tier: 'nurture' });

    expect(shouldNotifySlack(qualifiedLead)).toBe(true);
    expect(shouldNotifySlack(hotLead)).toBe(false);
    expect(shouldNotifySlack(nurtureLead)).toBe(false);
  });

  it('should format qualified lead for Slack with all relevant info', () => {
    const result = createScoringResult({
      lead_id: 'lead_qualified_001',
      score: 60,
      tier: 'qualified',
      recommended_angle: 'technical',
      personalization_hints: ['AI expertise', 'Growth focus'],
    });

    expect(shouldNotifySlack(result)).toBe(true);

    const message = formatSlackMessage(result);
    expect(message).toContain('lead_qualified_001');
    expect(message).toContain('60/100');
    expect(message).toContain('qualified');
    expect(message).toContain('technical');
    expect(message).toContain('AI expertise');
  });

  it('should provide top signals for decision making', () => {
    const result = createScoringResult({
      scoring_breakdown: [
        createRuleResult({ attribute: 'company_size', score: 30, reasoning: 'Enterprise' }),
        createRuleResult({ attribute: 'title', score: 25, reasoning: 'VP level' }),
        createRuleResult({ attribute: 'industry', score: 20, reasoning: 'Target vertical' }),
        createRuleResult({ attribute: 'funding', score: 5, reasoning: 'Unknown stage' }),
      ],
    });

    const topSignals = getTopSignals(result, 3);

    // Should get the 3 highest-scoring signals
    expect(topSignals.map((s) => s.attribute)).toEqual([
      'company_size',
      'title',
      'industry',
    ]);
  });
});
