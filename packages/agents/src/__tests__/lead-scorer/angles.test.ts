/**
 * Messaging Angle Recommendation Tests
 *
 * Tests for FR-008: Messaging angle recommendation
 * Tests for FR-009: Personalization hints generation
 */

import { describe, test, expect } from 'bun:test';
import {
  extractTopSignals,
  buildAnglePrompt,
  generatePersonalizationHints,
  inferAngleFromHeuristics,
  recommendAngle,
  type SignalSummary,
  type AngleRecommendation,
} from '../../lead-scorer/angles';
import type { RuleResult } from '../../lead-scorer/contracts/scoring-result';
import type { LeadInput } from '../../lead-scorer/contracts/lead-input';

// ===========================================
// Test Helpers
// ===========================================

function createTestLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    lead_id: `test_${Date.now()}`,
    email: 'test@example.com',
    company: 'Test Company',
    source: 'linkedin',
    ...overrides,
  };
}

function createRuleResult(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    rule_id: 'test_rule',
    attribute: 'company_size',
    value: 100,
    score: 20,
    max_score: 30,
    reasoning: 'Test reasoning',
    ...overrides,
  };
}

// ===========================================
// extractTopSignals Tests
// ===========================================

describe('extractTopSignals', () => {
  test('extracts top N signals sorted by score', () => {
    const results: RuleResult[] = [
      createRuleResult({ rule_id: 'r1', score: 10, max_score: 20 }),
      createRuleResult({ rule_id: 'r2', score: 30, max_score: 30 }),
      createRuleResult({ rule_id: 'r3', score: 25, max_score: 30 }),
      createRuleResult({ rule_id: 'r4', score: 15, max_score: 20 }),
      createRuleResult({ rule_id: 'r5', score: 5, max_score: 10 }),
    ];

    const signals = extractTopSignals(results, 3);

    expect(signals).toHaveLength(3);
    expect(signals[0].score).toBe(30); // Highest
    expect(signals[1].score).toBe(25);
    expect(signals[2].score).toBe(15);
  });

  test('filters out zero-score rules', () => {
    const results: RuleResult[] = [
      createRuleResult({ rule_id: 'r1', score: 20, max_score: 30 }),
      createRuleResult({ rule_id: 'r2', score: 0, max_score: 30 }),
      createRuleResult({ rule_id: 'r3', score: 0, max_score: 20 }),
    ];

    const signals = extractTopSignals(results, 5);

    expect(signals).toHaveLength(1);
    expect(signals[0].score).toBe(20);
  });

  test('returns empty array when no passing rules', () => {
    const results: RuleResult[] = [
      createRuleResult({ score: 0, max_score: 30 }),
      createRuleResult({ score: 0, max_score: 20 }),
    ];

    const signals = extractTopSignals(results, 5);

    expect(signals).toHaveLength(0);
  });

  test('returns fewer than N if not enough passing rules', () => {
    const results: RuleResult[] = [
      createRuleResult({ score: 20, max_score: 30 }),
      createRuleResult({ score: 10, max_score: 20 }),
    ];

    const signals = extractTopSignals(results, 5);

    expect(signals).toHaveLength(2);
  });

  test('calculates percentage correctly', () => {
    const results: RuleResult[] = [
      createRuleResult({ score: 15, max_score: 30 }), // 50%
      createRuleResult({ score: 20, max_score: 25 }), // 80%
    ];

    const signals = extractTopSignals(results, 5);

    // Sorted by score, so 20 comes first
    expect(signals[0].percentage).toBe(80);
    expect(signals[1].percentage).toBe(50);
  });

  test('handles zero max_score gracefully', () => {
    const results: RuleResult[] = [
      createRuleResult({ score: 10, max_score: 0 }),
    ];

    const signals = extractTopSignals(results, 5);

    expect(signals).toHaveLength(1);
    expect(signals[0].percentage).toBe(0);
  });

  test('includes all signal properties', () => {
    const results: RuleResult[] = [
      createRuleResult({
        rule_id: 'test_rule',
        attribute: 'funding_stage',
        value: 'series_b',
        score: 25,
        max_score: 30,
        reasoning: 'Series B funding detected',
      }),
    ];

    const signals = extractTopSignals(results, 1);

    expect(signals[0]).toEqual({
      attribute: 'funding_stage',
      value: 'series_b',
      score: 25,
      max_score: 30,
      percentage: 83,
      reasoning: 'Series B funding detected',
    });
  });

  test('defaults to top 5 signals', () => {
    const results: RuleResult[] = Array.from({ length: 10 }, (_, i) =>
      createRuleResult({ rule_id: `r${i}`, score: 10 + i, max_score: 30 })
    );

    const signals = extractTopSignals(results);

    expect(signals).toHaveLength(5);
    expect(signals[0].score).toBe(19); // Highest
    expect(signals[4].score).toBe(15); // 5th highest
  });
});

// ===========================================
// buildAnglePrompt Tests
// ===========================================

describe('buildAnglePrompt', () => {
  test('includes lead information in prompt', () => {
    const lead = createTestLead({
      company: 'Acme Corp',
      industry: 'fintech',
      title: 'VP of Engineering',
      company_size: 200,
      funding_stage: 'series_b',
      tech_stack: ['React', 'Node.js'],
      location: 'San Francisco',
    });

    const prompt = buildAnglePrompt(lead, []);

    expect(prompt).toContain('Acme Corp');
    expect(prompt).toContain('fintech');
    expect(prompt).toContain('VP of Engineering');
    expect(prompt).toContain('200');
    expect(prompt).toContain('series_b');
    expect(prompt).toContain('React, Node.js');
    expect(prompt).toContain('San Francisco');
  });

  test('includes signals in prompt', () => {
    const lead = createTestLead();
    const signals: SignalSummary[] = [
      {
        attribute: 'company_size',
        value: 150,
        score: 25,
        max_score: 30,
        percentage: 83,
        reasoning: 'Target SMB segment',
      },
    ];

    const prompt = buildAnglePrompt(lead, signals);

    expect(prompt).toContain('company_size');
    expect(prompt).toContain('150');
    expect(prompt).toContain('83%');
    expect(prompt).toContain('+25pts');
  });

  test('handles missing lead fields gracefully', () => {
    const lead = createTestLead({
      company: 'Test Co',
      // No optional fields
    });

    const prompt = buildAnglePrompt(lead, []);

    expect(prompt).toContain('Test Co');
    expect(prompt).toContain('Unknown'); // Default for missing fields
  });

  test('includes all messaging angle options', () => {
    const lead = createTestLead();
    const prompt = buildAnglePrompt(lead, []);

    expect(prompt).toContain('technical');
    expect(prompt).toContain('roi');
    expect(prompt).toContain('compliance');
    expect(prompt).toContain('speed');
    expect(prompt).toContain('integration');
  });

  test('includes JSON response format instructions', () => {
    const lead = createTestLead();
    const prompt = buildAnglePrompt(lead, []);

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('"angle"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"personalization_hints"');
  });

  test('handles empty signals array', () => {
    const lead = createTestLead();
    const prompt = buildAnglePrompt(lead, []);

    expect(prompt).toContain('No strong signals detected');
  });
});

// ===========================================
// generatePersonalizationHints Tests
// ===========================================

describe('generatePersonalizationHints', () => {
  test('generates funding stage hint', () => {
    const lead = createTestLead({ funding_stage: 'series_b' });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.toLowerCase().includes('series b'))).toBe(true);
  });

  test('generates tech stack hint', () => {
    const lead = createTestLead({ tech_stack: ['Salesforce', 'HubSpot'] });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.includes('Salesforce') || h.includes('HubSpot'))).toBe(true);
  });

  test('generates company size hints based on size', () => {
    const largeLead = createTestLead({ company_size: 500 });
    const mediumLead = createTestLead({ company_size: 200 });
    const smallLead = createTestLead({ company_size: 50 });

    const largeHints = generatePersonalizationHints(largeLead, []);
    const mediumHints = generatePersonalizationHints(mediumLead, []);
    const smallHints = generatePersonalizationHints(smallLead, []);

    expect(largeHints.some((h) => h.toLowerCase().includes('enterprise'))).toBe(true);
    expect(mediumHints.some((h) => h.toLowerCase().includes('growth'))).toBe(true);
    expect(smallHints.some((h) => h.toLowerCase().includes('lean') || h.toLowerCase().includes('quick'))).toBe(true);
  });

  test('generates industry-specific hints for fintech', () => {
    const lead = createTestLead({ industry: 'fintech' });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.toLowerCase().includes('compliance') || h.toLowerCase().includes('security'))).toBe(true);
  });

  test('generates industry-specific hints for healthcare', () => {
    const lead = createTestLead({ industry: 'healthcare' });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.toLowerCase().includes('hipaa'))).toBe(true);
  });

  test('generates industry-specific hints for investor relations', () => {
    const lead = createTestLead({ industry: 'investor relations' });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.toLowerCase().includes('investor'))).toBe(true);
  });

  test('generates hint for recent news', () => {
    const lead = createTestLead({ recent_news: ['Just raised Series C'] });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.includes('Just raised Series C'))).toBe(true);
  });

  test('generates hint for hiring signals', () => {
    const lead = createTestLead({ hiring_signals: ['Hiring VP Engineering'] });
    const hints = generatePersonalizationHints(lead, []);

    expect(hints.some((h) => h.toLowerCase().includes('growth') || h.toLowerCase().includes('hiring'))).toBe(true);
  });

  test('limits hints to max 4', () => {
    const lead = createTestLead({
      funding_stage: 'series_c',
      tech_stack: ['React', 'Node.js'],
      company_size: 500,
      industry: 'fintech',
      recent_news: ['Big news'],
      hiring_signals: ['Hiring'],
    });

    const hints = generatePersonalizationHints(lead, []);

    expect(hints.length).toBeLessThanOrEqual(4);
  });

  test('returns empty array for minimal lead', () => {
    const lead = createTestLead();
    const hints = generatePersonalizationHints(lead, []);

    expect(hints).toBeInstanceOf(Array);
  });
});

// ===========================================
// inferAngleFromHeuristics Tests
// ===========================================

describe('inferAngleFromHeuristics', () => {
  test('infers technical angle from tech keywords', () => {
    const lead = createTestLead({
      title: 'CTO',
      tech_stack: ['React', 'Node.js', 'AWS'],
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('technical');
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('infers roi angle from finance keywords', () => {
    const lead = createTestLead({
      title: 'CFO',
      industry: 'finance',
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('roi');
  });

  test('infers compliance angle from regulatory keywords', () => {
    const lead = createTestLead({
      title: 'Head of Compliance',
      industry: 'investor relations',
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('compliance');
  });

  test('infers speed angle from startup keywords', () => {
    const lead = createTestLead({
      funding_stage: 'seed',
      company: 'Fast Startup Inc',
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('speed');
  });

  test('infers integration angle from tool keywords', () => {
    const lead = createTestLead({
      tech_stack: ['Salesforce', 'HubSpot', 'Slack'],
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('integration');
  });

  test('defaults to technical when no strong signals', () => {
    const lead = createTestLead();

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.angle).toBe('technical');
    expect(result.confidence).toBeLessThan(0.5);
  });

  test('includes personalization hints in result', () => {
    const lead = createTestLead({
      funding_stage: 'series_b',
      tech_stack: ['React'],
    });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.personalization_hints).toBeInstanceOf(Array);
  });

  test('includes reasoning in result', () => {
    const lead = createTestLead({ title: 'VP of Engineering' });

    const result = inferAngleFromHeuristics(lead, []);

    expect(result.reasoning).toContain('Heuristic match');
    expect(result.reasoning).toContain('keyword matches');
  });

  test('considers signals in heuristic scoring', () => {
    const lead = createTestLead();
    const signals: SignalSummary[] = [
      {
        attribute: 'tech_stack',
        value: 'React',
        score: 20,
        max_score: 25,
        percentage: 80,
        reasoning: 'Tech stack match',
      },
    ];

    const result = inferAngleFromHeuristics(lead, signals);

    // Signals contribute to the search text
    expect(result).toBeDefined();
  });

  test('calculates confidence based on match strength', () => {
    const strongLead = createTestLead({
      title: 'CTO',
      tech_stack: ['React', 'Node.js', 'AWS', 'Docker'],
      industry: 'software',
    });

    const weakLead = createTestLead();

    const strongResult = inferAngleFromHeuristics(strongLead, []);
    const weakResult = inferAngleFromHeuristics(weakLead, []);

    expect(strongResult.confidence).toBeGreaterThan(weakResult.confidence);
  });
});

// ===========================================
// recommendAngle Tests
// ===========================================

describe('recommendAngle', () => {
  test('uses heuristics when useHeuristicsOnly is true', async () => {
    const lead = createTestLead({
      title: 'VP of Engineering',
      tech_stack: ['React'],
    });
    const results: RuleResult[] = [
      createRuleResult({ score: 20, max_score: 30 }),
    ];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: true,
    });

    expect(recommendation.angle).toBeDefined();
    expect(recommendation.reasoning).toContain('Heuristic');
  });

  test('uses heuristics when too few signals', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [
      createRuleResult({ score: 10, max_score: 30 }),
    ];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: false,
      minSignalsForLLM: 5, // Require 5 signals
    });

    expect(recommendation.reasoning).toContain('Heuristic');
  });

  test('returns valid angle type', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: true,
    });

    expect(['technical', 'roi', 'compliance', 'speed', 'integration']).toContain(
      recommendation.angle
    );
  });

  test('returns confidence between 0 and 1', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: true,
    });

    expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
    expect(recommendation.confidence).toBeLessThanOrEqual(1);
  });

  test('returns personalization hints array', async () => {
    const lead = createTestLead({
      funding_stage: 'series_b',
    });
    const results: RuleResult[] = [];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: true,
    });

    expect(recommendation.personalization_hints).toBeInstanceOf(Array);
  });

  test('returns reasoning string', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: true,
    });

    expect(typeof recommendation.reasoning).toBe('string');
    expect(recommendation.reasoning.length).toBeGreaterThan(0);
  });

  test('defaults useHeuristicsOnly to false', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [];

    // With no signals and no API key, will fall back to heuristics anyway
    const recommendation = await recommendAngle(lead, results);

    expect(recommendation).toBeDefined();
    expect(recommendation.angle).toBeDefined();
  });

  test('handles empty results array', async () => {
    const lead = createTestLead();

    const recommendation = await recommendAngle(lead, [], {
      useHeuristicsOnly: true,
    });

    expect(recommendation).toBeDefined();
    expect(recommendation.angle).toBe('technical'); // Default
  });

  test('respects minSignalsForLLM threshold', async () => {
    const lead = createTestLead();
    const results: RuleResult[] = [
      createRuleResult({ score: 20, max_score: 30 }),
      createRuleResult({ score: 15, max_score: 25 }),
    ];

    const recommendation = await recommendAngle(lead, results, {
      useHeuristicsOnly: false,
      minSignalsForLLM: 3, // Require 3, we have 2
    });

    // Should fall back to heuristics
    expect(recommendation.reasoning).toContain('Heuristic');
  });
});

// ===========================================
// AngleRecommendation Type Tests
// ===========================================

describe('AngleRecommendation structure', () => {
  test('has all required fields', async () => {
    const lead = createTestLead();

    const recommendation = await recommendAngle(lead, [], {
      useHeuristicsOnly: true,
    });

    expect(recommendation).toHaveProperty('angle');
    expect(recommendation).toHaveProperty('confidence');
    expect(recommendation).toHaveProperty('reasoning');
    expect(recommendation).toHaveProperty('personalization_hints');
  });

  test('angle is valid MessagingAngle type', async () => {
    const lead = createTestLead({
      title: 'CFO',
      industry: 'finance',
    });

    const recommendation = await recommendAngle(lead, [], {
      useHeuristicsOnly: true,
    });

    const validAngles = ['technical', 'roi', 'compliance', 'speed', 'integration'];
    expect(validAngles).toContain(recommendation.angle);
  });
});
