/**
 * Rule Evaluation Module
 *
 * Evaluates ICP rules against lead data using pure functions.
 * All operators are deterministic - no LLM calls needed.
 *
 * @module lead-scorer/rules
 */

import type { ICPRule, RuleCondition, RuleOperator } from '@atlas-gtm/lib';
import type { RuleResult } from './contracts/scoring-result';
import type { LeadInput } from './contracts/lead-input';

// ===========================================
// Rule Operator Functions (Pure)
// ===========================================

/**
 * Evaluate range condition (value between min and max)
 */
export function evaluateRange(
  value: unknown,
  min: number,
  max: number
): { matches: boolean; score: number } {
  if (typeof value !== 'number') {
    return { matches: false, score: 0 };
  }

  if (value >= min && value <= max) {
    // Calculate score based on position in range (center is best)
    const center = (min + max) / 2;
    const distance = Math.abs(value - center);
    const maxDistance = (max - min) / 2;
    const normalizedScore = 1 - (distance / maxDistance) * 0.3; // 70-100% of max score
    return { matches: true, score: normalizedScore };
  }

  return { matches: false, score: 0 };
}

/**
 * Evaluate equals condition (exact match)
 */
export function evaluateEquals(
  value: unknown,
  expected: string | number | boolean
): { matches: boolean; score: number } {
  if (value === expected) {
    return { matches: true, score: 1 };
  }

  // Case-insensitive string comparison
  if (
    typeof value === 'string' &&
    typeof expected === 'string' &&
    value.toLowerCase() === expected.toLowerCase()
  ) {
    return { matches: true, score: 1 };
  }

  return { matches: false, score: 0 };
}

/**
 * Evaluate contains condition (substring match)
 */
export function evaluateContains(
  value: unknown,
  substring: string
): { matches: boolean; score: number } {
  if (typeof value !== 'string') {
    return { matches: false, score: 0 };
  }

  if (value.toLowerCase().includes(substring.toLowerCase())) {
    return { matches: true, score: 1 };
  }

  return { matches: false, score: 0 };
}

/**
 * Evaluate greater_than condition (value > threshold)
 */
export function evaluateGreaterThan(
  value: unknown,
  threshold: number
): { matches: boolean; score: number } {
  if (typeof value !== 'number') {
    return { matches: false, score: 0 };
  }

  if (value > threshold) {
    // Diminishing returns for very high values
    const ratio = value / threshold;
    const score = Math.min(1, 0.7 + 0.3 * (1 / Math.log2(ratio + 1)));
    return { matches: true, score };
  }

  return { matches: false, score: 0 };
}

/**
 * Evaluate less_than condition (value < threshold)
 */
export function evaluateLessThan(
  value: unknown,
  threshold: number
): { matches: boolean; score: number } {
  if (typeof value !== 'number') {
    return { matches: false, score: 0 };
  }

  if (value < threshold) {
    // Better score for values further below threshold (within reason)
    const ratio = value / threshold;
    const score = Math.max(0.7, 1 - ratio * 0.3);
    return { matches: true, score };
  }

  return { matches: false, score: 0 };
}

/**
 * Evaluate in_list condition (value in array)
 */
export function evaluateInList(
  value: unknown,
  list: string[]
): { matches: boolean; score: number } {
  // Handle array values (e.g., tech_stack)
  if (Array.isArray(value)) {
    const matchCount = value.filter((v) =>
      list.some(
        (item) =>
          typeof v === 'string' &&
          v.toLowerCase() === item.toLowerCase()
      )
    ).length;

    if (matchCount > 0) {
      // Score based on percentage of list items matched
      const score = Math.min(1, matchCount / Math.min(list.length, 3));
      return { matches: true, score };
    }
    return { matches: false, score: 0 };
  }

  // Handle single string value
  if (typeof value === 'string') {
    const matches = list.some(
      (item) => value.toLowerCase() === item.toLowerCase()
    );
    return { matches, score: matches ? 1 : 0 };
  }

  return { matches: false, score: 0 };
}

// ===========================================
// Rule Evaluation Dispatcher
// ===========================================

/**
 * Evaluate a single rule condition against a value
 */
export function evaluateCondition(
  value: unknown,
  condition: RuleCondition
): { matches: boolean; score: number } {
  switch (condition.type) {
    case 'range':
      return evaluateRange(value, condition.min, condition.max);
    case 'equals':
      return evaluateEquals(value, condition.value);
    case 'contains':
      return evaluateContains(value, condition.value);
    case 'greater_than':
      return evaluateGreaterThan(value, condition.value);
    case 'less_than':
      return evaluateLessThan(value, condition.value);
    case 'in_list':
      return evaluateInList(value, condition.values);
    default:
      // Exhaustive check
      const _exhaustive: never = condition;
      return { matches: false, score: 0 };
  }
}

/**
 * Get the value of a lead attribute by name
 */
export function getLeadAttributeValue(
  lead: LeadInput,
  attribute: string
): unknown {
  // Handle nested attributes with dot notation (e.g., "enrichment_data.employees")
  if (attribute.includes('.')) {
    const parts = attribute.split('.');
    let value: unknown = lead;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }

  return (lead as Record<string, unknown>)[attribute];
}

/**
 * Evaluate a single ICP rule against a lead
 */
export function evaluateRule(
  lead: LeadInput,
  rule: ICPRule
): RuleResult {
  const value = getLeadAttributeValue(lead, rule.attribute);

  // Missing attribute handling: score 0 per spec
  if (value === undefined || value === null) {
    return {
      rule_id: rule.id,
      attribute: rule.attribute,
      value: null,
      score: 0,
      max_score: rule.max_score,
      reasoning: `Missing attribute: ${rule.attribute}`,
      is_knockout: rule.is_knockout ? true : undefined,
    };
  }

  const { matches, score: normalizedScore } = evaluateCondition(
    value,
    rule.condition
  );

  // Calculate actual score from normalized score (0-1) and max_score
  const actualScore = matches ? Math.round(normalizedScore * rule.max_score) : 0;

  // Generate reasoning
  // For knockout rules: matching the condition = lead is disqualified (e.g., industry in ["gambling"])
  const reasoning = matches
    ? rule.is_knockout
      ? `KNOCKOUT: ${rule.display_name}: ${JSON.stringify(value)} matches ${rule.operator} (disqualified)`
      : `${rule.display_name}: ${JSON.stringify(value)} matches ${rule.operator} condition (+${actualScore})`
    : `${rule.display_name}: ${JSON.stringify(value)} did not match ${rule.operator} condition`;

  return {
    rule_id: rule.id,
    attribute: rule.attribute,
    value,
    score: actualScore,
    max_score: rule.max_score,
    reasoning,
    // Knockout triggers when the rule matches (e.g., industry IS in bad list)
    is_knockout: rule.is_knockout && matches ? true : undefined,
  };
}

// ===========================================
// Batch Rule Evaluation
// ===========================================

/**
 * Evaluate all ICP rules against a lead
 * Returns results for all rules and knockout status
 */
export function evaluateAllRules(
  lead: LeadInput,
  rules: ICPRule[]
): {
  results: RuleResult[];
  knockoutFailed: string | null;
} {
  const results: RuleResult[] = [];
  let knockoutFailed: string | null = null;

  for (const rule of rules) {
    const result = evaluateRule(lead, rule);
    results.push(result);

    // Check for knockout failure (first one wins)
    if (result.is_knockout && !knockoutFailed) {
      knockoutFailed = rule.id;
    }
  }

  return { results, knockoutFailed };
}

// ===========================================
// Conflict Resolution
// ===========================================

/**
 * Resolve conflicting rules for the same attribute
 * Per FR-018: Use highest-scoring match
 */
export function resolveRuleConflicts(
  results: RuleResult[]
): RuleResult[] {
  // Group results by attribute
  const byAttribute = new Map<string, RuleResult[]>();

  for (const result of results) {
    const existing = byAttribute.get(result.attribute) || [];
    existing.push(result);
    byAttribute.set(result.attribute, existing);
  }

  // For each attribute, keep only the highest-scoring result
  const resolved: RuleResult[] = [];

  for (const [attribute, attributeResults] of byAttribute) {
    // Sort by score descending, then by max_score descending (prefer more impactful rules)
    const sorted = [...attributeResults].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.max_score - a.max_score;
    });

    // Keep the highest scorer, but preserve knockout status if any failed
    const best = sorted[0];
    const anyKnockout = sorted.some((r) => r.is_knockout);

    resolved.push({
      ...best,
      is_knockout: anyKnockout ? true : best.is_knockout,
    });
  }

  return resolved;
}

// ===========================================
// Rule Summary Helpers
// ===========================================

/**
 * Calculate total score from rule results
 */
export function sumRuleScores(results: RuleResult[]): number {
  return results.reduce((sum, r) => sum + r.score, 0);
}

/**
 * Calculate maximum possible score from rule results
 */
export function sumMaxScores(results: RuleResult[]): number {
  return results.reduce((sum, r) => sum + r.max_score, 0);
}

/**
 * Get only passing rules (score > 0)
 */
export function getPassingRules(results: RuleResult[]): RuleResult[] {
  return results.filter((r) => r.score > 0);
}

/**
 * Get only failing rules (score === 0)
 */
export function getFailingRules(results: RuleResult[]): RuleResult[] {
  return results.filter((r) => r.score === 0);
}
