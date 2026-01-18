/**
 * Vertical Detection Module
 *
 * Detects the appropriate vertical for a lead using a 3-tier hierarchy:
 * 1. Explicit vertical (if provided in lead data)
 * 2. Industry-based mapping
 * 3. Title keyword matching
 * 4. Default fallback
 *
 * @module lead-scorer/vertical-detector
 */

import type { LeadInput } from './contracts/lead-input';
import type { VerticalDetectionResult, VerticalSignal } from './types';

// ===========================================
// Industry to Vertical Mapping
// ===========================================

/**
 * Map common industries to verticals
 * Add new verticals here as brains are created
 */
export const INDUSTRY_TO_VERTICAL: Record<string, string> = {
  // IRO (Investor Relations Operations)
  'investor relations': 'iro',
  'capital markets': 'iro',
  'corporate finance': 'iro',
  'public companies': 'iro',
  'securities': 'iro',

  // Fintech
  'fintech': 'fintech',
  'financial technology': 'fintech',
  'payments': 'fintech',
  'banking technology': 'fintech',
  'neobank': 'fintech',
  'digital banking': 'fintech',
  'cryptocurrency': 'fintech',
  'blockchain': 'fintech',
  'defi': 'fintech',

  // Healthcare
  'healthcare': 'healthcare',
  'health tech': 'healthcare',
  'healthtech': 'healthcare',
  'medical devices': 'healthcare',
  'pharmaceuticals': 'healthcare',
  'biotech': 'healthcare',
  'digital health': 'healthcare',
  'telemedicine': 'healthcare',
  'life sciences': 'healthcare',

  // Defense
  'defense': 'defense',
  'aerospace': 'defense',
  'government contractor': 'defense',
  'military': 'defense',
  'national security': 'defense',
  'intelligence': 'defense',

  // SaaS (generic fallback for tech)
  'saas': 'saas',
  'software': 'saas',
  'enterprise software': 'saas',
  'b2b software': 'saas',
  'cloud computing': 'saas',
  'technology': 'saas',
};

// ===========================================
// Title Keywords to Vertical Mapping
// ===========================================

/**
 * Map title keywords to verticals
 * Lower priority than industry mapping
 */
export const TITLE_KEYWORDS_TO_VERTICAL: Record<string, string[]> = {
  iro: [
    'investor relations',
    'ir manager',
    'ir director',
    'ir officer',
    'chief financial officer',
    'cfo',
    'treasurer',
    'capital markets',
    'shareholder',
    'earnings',
  ],
  fintech: [
    'payments',
    'banking',
    'financial analyst',
    'risk officer',
    'compliance officer',
    'treasury',
    'trading',
    'fintech',
  ],
  healthcare: [
    'chief medical',
    'cmo',
    'healthcare',
    'clinical',
    'medical director',
    'health informatics',
    'patient',
    'provider',
  ],
  defense: [
    'defense',
    'military',
    'government',
    'security clearance',
    'aerospace',
    'contracting',
    'procurement',
  ],
  saas: [
    'product manager',
    'engineering',
    'cto',
    'chief technology',
    'devops',
    'developer',
    'software',
  ],
};

// ===========================================
// Default Vertical
// ===========================================

/**
 * Default vertical when no detection method succeeds
 * Should be the most generic/broadly applicable vertical
 */
export const DEFAULT_VERTICAL = 'saas';

// ===========================================
// Detection Functions
// ===========================================

/**
 * Detect vertical from explicit lead field
 */
function detectFromExplicit(lead: LeadInput): VerticalSignal | null {
  if (lead.vertical && lead.vertical.trim().length > 0) {
    return {
      attribute: 'vertical',
      value: lead.vertical,
      matched_vertical: lead.vertical.toLowerCase(),
      weight: 1.0, // Highest confidence
    };
  }
  return null;
}

/**
 * Detect vertical from industry field
 */
function detectFromIndustry(lead: LeadInput): VerticalSignal | null {
  if (!lead.industry) return null;

  const industryLower = lead.industry.toLowerCase();

  // Try exact match first
  if (INDUSTRY_TO_VERTICAL[industryLower]) {
    return {
      attribute: 'industry',
      value: lead.industry,
      matched_vertical: INDUSTRY_TO_VERTICAL[industryLower],
      weight: 0.9,
    };
  }

  // Try partial match
  for (const [pattern, vertical] of Object.entries(INDUSTRY_TO_VERTICAL)) {
    if (industryLower.includes(pattern) || pattern.includes(industryLower)) {
      return {
        attribute: 'industry',
        value: lead.industry,
        matched_vertical: vertical,
        weight: 0.7,
      };
    }
  }

  return null;
}

/**
 * Detect vertical from job title
 */
function detectFromTitle(lead: LeadInput): VerticalSignal | null {
  if (!lead.title) return null;

  const titleLower = lead.title.toLowerCase();

  for (const [vertical, keywords] of Object.entries(TITLE_KEYWORDS_TO_VERTICAL)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return {
          attribute: 'title',
          value: lead.title,
          matched_vertical: vertical,
          weight: 0.5,
        };
      }
    }
  }

  return null;
}

/**
 * Get default vertical signal
 */
function getDefaultSignal(): VerticalSignal {
  return {
    attribute: 'default',
    value: 'none',
    matched_vertical: DEFAULT_VERTICAL,
    weight: 0.1,
  };
}

// ===========================================
// Main Detection Function
// ===========================================

/**
 * Detect vertical for a lead using 3-tier hierarchy
 *
 * Order of precedence:
 * 1. Explicit vertical field (confidence: 1.0)
 * 2. Industry mapping (confidence: 0.7-0.9)
 * 3. Title keyword matching (confidence: 0.5)
 * 4. Default fallback (confidence: 0.1)
 */
export function detectVertical(lead: LeadInput): VerticalDetectionResult {
  const signals: VerticalSignal[] = [];

  // Try each detection method in order
  const explicitSignal = detectFromExplicit(lead);
  if (explicitSignal) {
    signals.push(explicitSignal);
    return {
      vertical: explicitSignal.matched_vertical,
      confidence: explicitSignal.weight,
      signals,
    };
  }

  const industrySignal = detectFromIndustry(lead);
  if (industrySignal) {
    signals.push(industrySignal);
    return {
      vertical: industrySignal.matched_vertical,
      confidence: industrySignal.weight,
      signals,
    };
  }

  const titleSignal = detectFromTitle(lead);
  if (titleSignal) {
    signals.push(titleSignal);
    return {
      vertical: titleSignal.matched_vertical,
      confidence: titleSignal.weight,
      signals,
    };
  }

  // Default fallback
  const defaultSignal = getDefaultSignal();
  signals.push(defaultSignal);
  return {
    vertical: defaultSignal.matched_vertical,
    confidence: defaultSignal.weight,
    signals,
  };
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Get all available verticals
 */
export function getAvailableVerticals(): string[] {
  const verticals = new Set<string>();

  for (const vertical of Object.values(INDUSTRY_TO_VERTICAL)) {
    verticals.add(vertical);
  }

  for (const vertical of Object.keys(TITLE_KEYWORDS_TO_VERTICAL)) {
    verticals.add(vertical);
  }

  return Array.from(verticals).sort();
}

/**
 * Check if a vertical is supported
 */
export function isVerticalSupported(vertical: string): boolean {
  return getAvailableVerticals().includes(vertical.toLowerCase());
}

/**
 * Get detection method name for a confidence level
 */
export function getDetectionMethod(
  confidence: number
): 'explicit' | 'industry' | 'title' | 'default' {
  if (confidence >= 1.0) return 'explicit';
  if (confidence >= 0.7) return 'industry';
  if (confidence >= 0.5) return 'title';
  return 'default';
}
