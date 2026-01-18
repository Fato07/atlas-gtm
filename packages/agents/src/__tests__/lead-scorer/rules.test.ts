/**
 * Rule Evaluation Unit Tests
 *
 * Tests for ICP rule evaluation operators:
 * - range, equals, contains, greater_than, less_than, in_list
 */

import { describe, test, expect } from 'bun:test';
import {
  evaluateRange,
  evaluateEquals,
  evaluateContains,
  evaluateGreaterThan,
  evaluateLessThan,
  evaluateInList,
  evaluateCondition,
  evaluateRule,
  evaluateAllRules,
  resolveRuleConflicts,
  getLeadAttributeValue,
  sumRuleScores,
  sumMaxScores,
} from '../../lead-scorer/rules';
import type { ICPRule, BrainId } from '@atlas-gtm/lib';
import type { LeadInput } from '../../lead-scorer/contracts/lead-input';

// ===========================================
// Test Helpers
// ===========================================

function createLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    lead_id: 'test_lead_001',
    email: 'test@example.com',
    company: 'Test Company',
    source: 'linkedin',
    ...overrides,
  };
}

function createRule(overrides: Partial<ICPRule> = {}): ICPRule {
  return {
    id: 'test_rule_001',
    brain_id: 'brain_test_v1' as BrainId,
    vertical: 'test',
    category: 'firmographic',
    attribute: 'company_size',
    display_name: 'Test Rule',
    condition: { type: 'range', min: 50, max: 500 },
    operator: 'range',
    score_weight: 1.0,
    max_score: 30,
    is_knockout: false,
    reasoning: 'Test reasoning',
    source: 'hypothesis',
    validated: false,
    ...overrides,
  };
}

// ===========================================
// evaluateRange
// ===========================================

describe('evaluateRange', () => {
  test('matches value within range', () => {
    const result = evaluateRange(100, 50, 500);

    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('matches value at lower bound', () => {
    const result = evaluateRange(50, 50, 500);

    expect(result.matches).toBe(true);
  });

  test('matches value at upper bound', () => {
    const result = evaluateRange(500, 50, 500);

    expect(result.matches).toBe(true);
  });

  test('does not match value below range', () => {
    const result = evaluateRange(25, 50, 500);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('does not match value above range', () => {
    const result = evaluateRange(600, 50, 500);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('returns 0 for non-numeric values', () => {
    const result = evaluateRange('not a number', 50, 500);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('gives higher score for center of range', () => {
    const center = evaluateRange(275, 50, 500); // Center
    const edge = evaluateRange(50, 50, 500); // Edge

    expect(center.score).toBeGreaterThan(edge.score);
  });
});

// ===========================================
// evaluateEquals
// ===========================================

describe('evaluateEquals', () => {
  test('matches exact string value', () => {
    const result = evaluateEquals('fintech', 'fintech');

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('matches exact number value', () => {
    const result = evaluateEquals(100, 100);

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('matches exact boolean value', () => {
    const result = evaluateEquals(true, true);

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('case-insensitive string matching', () => {
    const result = evaluateEquals('FinTech', 'fintech');

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('does not match different values', () => {
    const result = evaluateEquals('healthcare', 'fintech');

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('does not match different types', () => {
    const result = evaluateEquals('100', 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ===========================================
// evaluateContains
// ===========================================

describe('evaluateContains', () => {
  test('matches substring', () => {
    const result = evaluateContains('VP of Engineering', 'engineering');

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('case-insensitive substring matching', () => {
    const result = evaluateContains('VP of ENGINEERING', 'engineering');

    expect(result.matches).toBe(true);
  });

  test('matches exact string', () => {
    const result = evaluateContains('CFO', 'cfo');

    expect(result.matches).toBe(true);
  });

  test('does not match when substring not found', () => {
    const result = evaluateContains('VP of Sales', 'engineering');

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('returns 0 for non-string values', () => {
    const result = evaluateContains(123, 'engineering');

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ===========================================
// evaluateGreaterThan
// ===========================================

describe('evaluateGreaterThan', () => {
  test('matches value greater than threshold', () => {
    const result = evaluateGreaterThan(150, 100);

    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('does not match value equal to threshold', () => {
    const result = evaluateGreaterThan(100, 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('does not match value less than threshold', () => {
    const result = evaluateGreaterThan(50, 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('returns 0 for non-numeric values', () => {
    const result = evaluateGreaterThan('large', 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ===========================================
// evaluateLessThan
// ===========================================

describe('evaluateLessThan', () => {
  test('matches value less than threshold', () => {
    const result = evaluateLessThan(50, 100);

    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('does not match value equal to threshold', () => {
    const result = evaluateLessThan(100, 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('does not match value greater than threshold', () => {
    const result = evaluateLessThan(150, 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('returns 0 for non-numeric values', () => {
    const result = evaluateLessThan('small', 100);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ===========================================
// evaluateInList
// ===========================================

describe('evaluateInList', () => {
  test('matches single value in list', () => {
    const result = evaluateInList('series_b', ['series_a', 'series_b', 'series_c']);

    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test('case-insensitive matching', () => {
    const result = evaluateInList('Series_B', ['series_a', 'series_b', 'series_c']);

    expect(result.matches).toBe(true);
  });

  test('matches array value with list intersection', () => {
    const result = evaluateInList(
      ['React', 'TypeScript', 'Node.js'],
      ['React', 'Vue', 'Angular']
    );

    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('multiple array matches give higher score', () => {
    const oneMatch = evaluateInList(['React'], ['React', 'Vue', 'Angular']);
    const twoMatches = evaluateInList(['React', 'Vue'], ['React', 'Vue', 'Angular']);

    expect(twoMatches.score).toBeGreaterThan(oneMatch.score);
  });

  test('does not match value not in list', () => {
    const result = evaluateInList('series_d', ['series_a', 'series_b', 'series_c']);

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('does not match array with no intersection', () => {
    const result = evaluateInList(
      ['Svelte', 'Solid'],
      ['React', 'Vue', 'Angular']
    );

    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });
});

// ===========================================
// evaluateCondition
// ===========================================

describe('evaluateCondition', () => {
  test('dispatches range condition correctly', () => {
    const result = evaluateCondition(100, { type: 'range', min: 50, max: 500 });

    expect(result.matches).toBe(true);
  });

  test('dispatches equals condition correctly', () => {
    const result = evaluateCondition('fintech', { type: 'equals', value: 'fintech' });

    expect(result.matches).toBe(true);
  });

  test('dispatches contains condition correctly', () => {
    const result = evaluateCondition('VP of Sales', { type: 'contains', value: 'sales' });

    expect(result.matches).toBe(true);
  });

  test('dispatches greater_than condition correctly', () => {
    const result = evaluateCondition(150, { type: 'greater_than', value: 100 });

    expect(result.matches).toBe(true);
  });

  test('dispatches less_than condition correctly', () => {
    const result = evaluateCondition(50, { type: 'less_than', value: 100 });

    expect(result.matches).toBe(true);
  });

  test('dispatches in_list condition correctly', () => {
    const result = evaluateCondition('series_b', {
      type: 'in_list',
      values: ['series_a', 'series_b'],
    });

    expect(result.matches).toBe(true);
  });
});

// ===========================================
// getLeadAttributeValue
// ===========================================

describe('getLeadAttributeValue', () => {
  test('gets simple attribute', () => {
    const lead = createLead({ company_size: 100 });
    const value = getLeadAttributeValue(lead, 'company_size');

    expect(value).toBe(100);
  });

  test('returns undefined for missing attribute', () => {
    const lead = createLead();
    const value = getLeadAttributeValue(lead, 'company_size');

    expect(value).toBeUndefined();
  });

  test('handles nested attribute with dot notation', () => {
    const lead = createLead({
      enrichment_data: { employees: 150 },
    });
    const value = getLeadAttributeValue(lead, 'enrichment_data.employees');

    expect(value).toBe(150);
  });
});

// ===========================================
// evaluateRule
// ===========================================

describe('evaluateRule', () => {
  test('evaluates matching rule correctly', () => {
    const lead = createLead({ company_size: 100 });
    const rule = createRule({
      attribute: 'company_size',
      condition: { type: 'range', min: 50, max: 500 },
      max_score: 30,
    });

    const result = evaluateRule(lead, rule);

    expect(result.rule_id).toBe(rule.id);
    expect(result.attribute).toBe('company_size');
    expect(result.value).toBe(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.max_score).toBe(30);
    expect(result.is_knockout).toBeUndefined();
  });

  test('returns score 0 for missing attribute', () => {
    const lead = createLead(); // No company_size
    const rule = createRule({ attribute: 'company_size' });

    const result = evaluateRule(lead, rule);

    expect(result.score).toBe(0);
    expect(result.value).toBeNull();
    expect(result.reasoning).toContain('Missing attribute');
  });

  test('marks knockout failure correctly', () => {
    const lead = createLead({ industry: 'gambling' });
    const rule = createRule({
      attribute: 'industry',
      condition: { type: 'in_list', values: ['gambling', 'tobacco'] },
      operator: 'in_list',
      is_knockout: true,
      max_score: 0,
    });

    const result = evaluateRule(lead, rule);

    // Note: The rule matches (gambling is in list), but it's a knockout
    // The is_knockout flag indicates failure based on the match
    expect(result.is_knockout).toBe(true);
  });
});

// ===========================================
// evaluateAllRules
// ===========================================

describe('evaluateAllRules', () => {
  test('evaluates all rules and returns results', () => {
    const lead = createLead({
      company_size: 100,
      title: 'VP of Sales',
    });
    const rules = [
      createRule({
        id: 'rule_1',
        attribute: 'company_size',
        condition: { type: 'range', min: 50, max: 500 },
      }),
      createRule({
        id: 'rule_2',
        attribute: 'title',
        condition: { type: 'contains', value: 'vp' },
        operator: 'contains',
      }),
    ];

    const { results, knockoutFailed } = evaluateAllRules(lead, rules);

    expect(results).toHaveLength(2);
    expect(knockoutFailed).toBeNull();
  });

  test('detects knockout failure', () => {
    const lead = createLead({ industry: 'gambling' });
    const rules = [
      createRule({
        id: 'knockout_rule',
        attribute: 'industry',
        condition: { type: 'in_list', values: ['gambling', 'tobacco'] },
        operator: 'in_list',
        is_knockout: true,
      }),
    ];

    const { results, knockoutFailed } = evaluateAllRules(lead, rules);

    expect(knockoutFailed).toBe('knockout_rule');
  });
});

// ===========================================
// resolveRuleConflicts
// ===========================================

describe('resolveRuleConflicts', () => {
  test('keeps highest-scoring result per attribute', () => {
    const results = [
      {
        rule_id: 'rule_1',
        attribute: 'company_size',
        value: 100,
        score: 20,
        max_score: 30,
        reasoning: 'Rule 1',
      },
      {
        rule_id: 'rule_2',
        attribute: 'company_size',
        value: 100,
        score: 25,
        max_score: 30,
        reasoning: 'Rule 2',
      },
    ];

    const resolved = resolveRuleConflicts(results);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].rule_id).toBe('rule_2');
    expect(resolved[0].score).toBe(25);
  });

  test('preserves knockout status from any conflicting rule', () => {
    const results = [
      {
        rule_id: 'rule_1',
        attribute: 'industry',
        value: 'fintech',
        score: 10,
        max_score: 10,
        reasoning: 'Good',
      },
      {
        rule_id: 'rule_2',
        attribute: 'industry',
        value: 'fintech',
        score: 0,
        max_score: 0,
        reasoning: 'Knockout',
        is_knockout: true,
      },
    ];

    const resolved = resolveRuleConflicts(results);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].is_knockout).toBe(true);
  });

  test('handles multiple different attributes', () => {
    const results = [
      {
        rule_id: 'rule_1',
        attribute: 'company_size',
        value: 100,
        score: 20,
        max_score: 30,
        reasoning: 'Size',
      },
      {
        rule_id: 'rule_2',
        attribute: 'title',
        value: 'VP',
        score: 15,
        max_score: 20,
        reasoning: 'Title',
      },
    ];

    const resolved = resolveRuleConflicts(results);

    expect(resolved).toHaveLength(2);
  });
});

// ===========================================
// Score Helpers
// ===========================================

describe('sumRuleScores', () => {
  test('sums all rule scores', () => {
    const results = [
      { rule_id: '1', attribute: 'a', value: 1, score: 20, max_score: 30, reasoning: '' },
      { rule_id: '2', attribute: 'b', value: 2, score: 15, max_score: 20, reasoning: '' },
      { rule_id: '3', attribute: 'c', value: 3, score: 10, max_score: 25, reasoning: '' },
    ];

    expect(sumRuleScores(results)).toBe(45);
  });
});

describe('sumMaxScores', () => {
  test('sums all max scores', () => {
    const results = [
      { rule_id: '1', attribute: 'a', value: 1, score: 20, max_score: 30, reasoning: '' },
      { rule_id: '2', attribute: 'b', value: 2, score: 15, max_score: 20, reasoning: '' },
      { rule_id: '3', attribute: 'c', value: 3, score: 10, max_score: 25, reasoning: '' },
    ];

    expect(sumMaxScores(results)).toBe(75);
  });
});

// ===========================================
// Edge Case: Empty Rule Set (T065)
// ===========================================

describe('Edge case: empty rule set handling', () => {
  test('evaluateAllRules returns empty results for empty rule set', () => {
    const lead = createLead({ company_size: 100 });
    const { results } = evaluateAllRules(lead, []);

    expect(results).toHaveLength(0);
  });

  test('sumRuleScores returns 0 for empty results', () => {
    expect(sumRuleScores([])).toBe(0);
  });

  test('sumMaxScores returns 0 for empty results', () => {
    expect(sumMaxScores([])).toBe(0);
  });

  test('empty rule set results in 0/0 raw score', () => {
    const lead = createLead({ company_size: 100 });
    const { results } = evaluateAllRules(lead, []);

    const rawScore = sumRuleScores(results);
    const maxScore = sumMaxScores(results);

    expect(rawScore).toBe(0);
    expect(maxScore).toBe(0);
  });

  test('resolveRuleConflicts handles empty results', () => {
    const resolved = resolveRuleConflicts([]);

    expect(resolved).toHaveLength(0);
  });

  test('evaluateAllRules with empty rules returns null knockoutFailed', () => {
    const lead = createLead({ company_size: 100 });
    const { knockoutFailed } = evaluateAllRules(lead, []);

    expect(knockoutFailed).toBeNull();
  });
});
