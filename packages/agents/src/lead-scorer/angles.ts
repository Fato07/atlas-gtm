/**
 * Messaging Angle Recommendation Module
 *
 * Recommends the best messaging angle and personalization hints
 * based on top scoring signals from ICP rule evaluation.
 *
 * FR-008: Recommend messaging angle (technical, roi, compliance, speed, integration)
 * FR-009: Generate personalization hints based on matched signals
 *
 * @module lead-scorer/angles
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessagingAngle } from './contracts/scoring-result';
import type { RuleResult } from './contracts/scoring-result';
import type { LeadInput } from './contracts/lead-input';

// ===========================================
// Types
// ===========================================

export interface AngleRecommendation {
  angle: MessagingAngle;
  confidence: number;
  reasoning: string;
  personalization_hints: string[];
}

export interface SignalSummary {
  attribute: string;
  value: unknown;
  score: number;
  max_score: number;
  percentage: number;
  reasoning: string;
}

// ===========================================
// Signal Extraction
// ===========================================

/**
 * Extract top N highest-scoring rule results
 * Used as input for angle inference
 */
export function extractTopSignals(
  results: RuleResult[],
  topN: number = 5
): SignalSummary[] {
  // Filter to only passing rules (score > 0) and sort by score descending
  const passingRules = results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return passingRules.map((r) => ({
    attribute: r.attribute,
    value: r.value,
    score: r.score,
    max_score: r.max_score,
    percentage: r.max_score > 0 ? Math.round((r.score / r.max_score) * 100) : 0,
    reasoning: r.reasoning,
  }));
}

// ===========================================
// Angle Inference Prompt
// ===========================================

/**
 * Generate the Claude prompt for angle inference
 */
export function buildAnglePrompt(
  lead: LeadInput,
  signals: SignalSummary[]
): string {
  const signalsText = signals
    .map(
      (s) =>
        `- ${s.attribute}: ${JSON.stringify(s.value)} (${s.percentage}% match, +${s.score}pts)`
    )
    .join('\n');

  return `You are an expert sales strategist analyzing a lead to determine the best messaging angle for outreach.

## Lead Information
- Company: ${lead.company}
- Industry: ${lead.industry || 'Unknown'}
- Title: ${lead.title || 'Unknown'}
- Company Size: ${lead.company_size || 'Unknown'}
- Funding Stage: ${lead.funding_stage || 'Unknown'}
- Tech Stack: ${lead.tech_stack?.join(', ') || 'Unknown'}
- Location: ${lead.location || 'Unknown'}

## Top Scoring Signals
${signalsText || 'No strong signals detected'}

## Available Messaging Angles
1. **technical** - Lead with product capabilities, automation, technical features
2. **roi** - Lead with cost savings, efficiency gains, time savings
3. **compliance** - Lead with regulatory requirements, reporting needs, audit readiness
4. **speed** - Lead with quick implementation, fast time-to-value, rapid deployment
5. **integration** - Lead with ecosystem compatibility, existing tool connections

## Your Task
Based on the lead information and scoring signals, determine:
1. The best messaging angle from the 5 options above
2. 2-4 specific personalization hints for the outreach (e.g., "Mention their recent Series B", "Reference their Salesforce integration")

Respond ONLY with valid JSON in this exact format:
{
  "angle": "technical" | "roi" | "compliance" | "speed" | "integration",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this angle fits best",
  "personalization_hints": ["hint 1", "hint 2", "hint 3"]
}`;
}

// ===========================================
// Claude API Integration
// ===========================================

// Default model for angle inference (fast, cheap, good enough)
const ANGLE_MODEL = 'claude-3-5-haiku-latest';

/**
 * Call Claude to infer messaging angle
 */
export async function callClaudeForAngle(
  prompt: string,
  apiKey?: string
): Promise<AngleRecommendation> {
  const anthropic = new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: ANGLE_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AngleRecommendation;

  // Validate angle is one of the allowed values
  const validAngles: MessagingAngle[] = [
    'technical',
    'roi',
    'compliance',
    'speed',
    'integration',
  ];
  if (!validAngles.includes(parsed.angle)) {
    throw new Error(`Invalid angle from Claude: ${parsed.angle}`);
  }

  return {
    angle: parsed.angle,
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    reasoning: parsed.reasoning || 'No reasoning provided',
    personalization_hints: parsed.personalization_hints || [],
  };
}

// ===========================================
// Main Recommendation Functions
// ===========================================

/**
 * Recommend messaging angle based on scoring signals
 *
 * Uses Claude claude-3-5-haiku for inference when signals are strong enough,
 * falls back to heuristics for simple cases.
 */
export async function recommendAngle(
  lead: LeadInput,
  results: RuleResult[],
  options: {
    apiKey?: string;
    useHeuristicsOnly?: boolean;
    minSignalsForLLM?: number;
  } = {}
): Promise<AngleRecommendation> {
  const { apiKey, useHeuristicsOnly = false, minSignalsForLLM = 2 } = options;

  const topSignals = extractTopSignals(results, 5);

  // If too few signals or heuristics-only mode, use rule-based approach
  if (useHeuristicsOnly || topSignals.length < minSignalsForLLM) {
    return inferAngleFromHeuristics(lead, topSignals);
  }

  try {
    const prompt = buildAnglePrompt(lead, topSignals);
    return await callClaudeForAngle(prompt, apiKey);
  } catch (error) {
    // Fallback to heuristics on LLM error
    console.warn('Claude angle inference failed, using heuristics:', error);
    return inferAngleFromHeuristics(lead, topSignals);
  }
}

/**
 * Generate personalization hints from matched signals
 */
export function generatePersonalizationHints(
  lead: LeadInput,
  signals: SignalSummary[]
): string[] {
  const hints: string[] = [];

  // Funding stage hint
  if (lead.funding_stage) {
    const stageDisplay = lead.funding_stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    hints.push(`Mention their ${stageDisplay} funding stage`);
  }

  // Tech stack hints
  if (lead.tech_stack && lead.tech_stack.length > 0) {
    const topTech = lead.tech_stack.slice(0, 2).join(' and ');
    hints.push(`Reference their ${topTech} stack`);
  }

  // Company size hint
  if (lead.company_size) {
    if (lead.company_size >= 500) {
      hints.push('Emphasize enterprise-grade scalability');
    } else if (lead.company_size >= 100) {
      hints.push('Highlight growth-stage company features');
    } else {
      hints.push('Focus on quick setup and lean team benefits');
    }
  }

  // Industry-specific hints
  if (lead.industry) {
    const industry = lead.industry.toLowerCase();
    if (industry.includes('fintech') || industry.includes('financial')) {
      hints.push('Highlight compliance and security features');
    } else if (industry.includes('health')) {
      hints.push('Emphasize HIPAA compliance capabilities');
    } else if (industry.includes('investor') || industry.includes('ir')) {
      hints.push('Focus on investor communication efficiency');
    }
  }

  // Recent news/signals hints
  if (lead.recent_news && lead.recent_news.length > 0) {
    hints.push(`Reference their recent news: "${lead.recent_news[0]}"`);
  }

  // Hiring signals hint
  if (lead.hiring_signals && lead.hiring_signals.length > 0) {
    hints.push('Mention their growth trajectory based on hiring');
  }

  return hints.slice(0, 4); // Max 4 hints
}

// ===========================================
// Heuristic Fallback
// ===========================================

/**
 * Signal keywords that map to each angle
 */
const ANGLE_KEYWORDS: Record<MessagingAngle, string[]> = {
  technical: [
    'tech_stack',
    'engineering',
    'developer',
    'api',
    'integration',
    'automation',
    'platform',
    'software',
    'cto',
    'vp of engineering',
  ],
  roi: [
    'revenue',
    'cost',
    'efficiency',
    'savings',
    'budget',
    'cfo',
    'finance',
    'growth',
    'scale',
    'performance',
  ],
  compliance: [
    'regulatory',
    'compliance',
    'sec',
    'audit',
    'reporting',
    'legal',
    'governance',
    'risk',
    'public company',
    'investor relations',
  ],
  speed: [
    'startup',
    'fast',
    'agile',
    'launch',
    'rapid',
    'quick',
    'immediate',
    'urgent',
    'seed',
    'series_a',
  ],
  integration: [
    'salesforce',
    'hubspot',
    'slack',
    'microsoft',
    'google',
    'tools',
    'ecosystem',
    'workflow',
    'connect',
    'sync',
  ],
};

/**
 * Infer angle from heuristics when LLM is unavailable
 */
export function inferAngleFromHeuristics(
  lead: LeadInput,
  signals: SignalSummary[]
): AngleRecommendation {
  const scores: Record<MessagingAngle, number> = {
    technical: 0,
    roi: 0,
    compliance: 0,
    speed: 0,
    integration: 0,
  };

  // Build searchable text from lead and signals
  const searchText = [
    lead.title || '',
    lead.industry || '',
    lead.company || '',
    lead.funding_stage || '',
    ...(lead.tech_stack || []),
    ...signals.map((s) => `${s.attribute} ${JSON.stringify(s.value)}`),
  ]
    .join(' ')
    .toLowerCase();

  // Score each angle based on keyword matches
  for (const [angle, keywords] of Object.entries(ANGLE_KEYWORDS) as [
    MessagingAngle,
    string[],
  ][]) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        scores[angle] += 1;
      }
    }
  }

  // Find highest scoring angle
  let bestAngle: MessagingAngle = 'technical'; // Default
  let bestScore = 0;

  for (const [angle, score] of Object.entries(scores) as [
    MessagingAngle,
    number,
  ][]) {
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  // Calculate confidence based on score difference
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const confidence =
    totalScore > 0 ? Math.min(0.8, bestScore / totalScore + 0.2) : 0.3;

  // Generate hints
  const hints = generatePersonalizationHints(lead, signals);

  return {
    angle: bestAngle,
    confidence,
    reasoning: `Heuristic match: ${bestScore} keyword matches for ${bestAngle} angle`,
    personalization_hints: hints,
  };
}
