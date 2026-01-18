/**
 * Vertical Detection Unit Tests
 *
 * Tests for the 3-tier vertical detection hierarchy:
 * 1. Explicit vertical
 * 2. Industry mapping
 * 3. Title keyword matching
 * 4. Default fallback
 */

import { describe, test, expect } from 'bun:test';
import {
  detectVertical,
  getAvailableVerticals,
  isVerticalSupported,
  getDetectionMethod,
  DEFAULT_VERTICAL,
  INDUSTRY_TO_VERTICAL,
  TITLE_KEYWORDS_TO_VERTICAL,
} from '../../lead-scorer/vertical-detector';
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

// ===========================================
// Explicit Vertical Detection
// ===========================================

describe('detectVertical - Explicit vertical', () => {
  test('uses explicit vertical when provided', () => {
    const lead = createLead({ vertical: 'fintech' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
    expect(result.confidence).toBe(1.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].attribute).toBe('vertical');
  });

  test('normalizes explicit vertical to lowercase', () => {
    const lead = createLead({ vertical: 'FinTech' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
  });

  test('ignores empty explicit vertical', () => {
    const lead = createLead({ vertical: '' });
    const result = detectVertical(lead);

    // Should fall through to other detection methods
    expect(result.confidence).toBeLessThan(1.0);
  });

  test('ignores whitespace-only explicit vertical', () => {
    const lead = createLead({ vertical: '   ' });
    const result = detectVertical(lead);

    expect(result.confidence).toBeLessThan(1.0);
  });
});

// ===========================================
// Industry-Based Detection
// ===========================================

describe('detectVertical - Industry mapping', () => {
  test('maps fintech industry correctly', () => {
    const lead = createLead({ industry: 'fintech' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.signals[0].attribute).toBe('industry');
  });

  test('maps healthcare industry correctly', () => {
    const lead = createLead({ industry: 'healthcare' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('healthcare');
  });

  test('maps defense industry correctly', () => {
    const lead = createLead({ industry: 'defense' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('defense');
  });

  test('maps investor relations industry to iro', () => {
    const lead = createLead({ industry: 'investor relations' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('iro');
  });

  test('handles case-insensitive industry matching', () => {
    const lead = createLead({ industry: 'FINTECH' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
  });

  test('matches partial industry names', () => {
    const lead = createLead({ industry: 'financial technology company' });
    const result = detectVertical(lead);

    // Should match 'fintech' or 'financial technology'
    expect(result.vertical).toBe('fintech');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('falls through when industry not recognized', () => {
    const lead = createLead({ industry: 'unknown_industry_xyz' });
    const result = detectVertical(lead);

    // Should use title or default
    expect(result.confidence).toBeLessThan(0.7);
  });
});

// ===========================================
// Title Keyword Detection
// ===========================================

describe('detectVertical - Title keywords', () => {
  test('detects iro from IR title', () => {
    const lead = createLead({ title: 'Director of Investor Relations' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('iro');
    expect(result.confidence).toBe(0.5);
    expect(result.signals[0].attribute).toBe('title');
  });

  test('detects iro from CFO title', () => {
    const lead = createLead({ title: 'Chief Financial Officer' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('iro');
  });

  test('detects fintech from payments title', () => {
    const lead = createLead({ title: 'Head of Payments' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
  });

  test('detects healthcare from clinical title', () => {
    const lead = createLead({ title: 'Clinical Director' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('healthcare');
  });

  test('detects saas from engineering title', () => {
    const lead = createLead({ title: 'VP of Engineering' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('saas');
  });

  test('handles case-insensitive title matching', () => {
    const lead = createLead({ title: 'INVESTOR RELATIONS MANAGER' });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('iro');
  });
});

// ===========================================
// Default Fallback
// ===========================================

describe('detectVertical - Default fallback', () => {
  test('returns default vertical when no signals match', () => {
    const lead = createLead({
      industry: undefined,
      title: undefined,
      vertical: undefined,
    });
    const result = detectVertical(lead);

    expect(result.vertical).toBe(DEFAULT_VERTICAL);
    expect(result.confidence).toBe(0.1);
    expect(result.signals[0].attribute).toBe('default');
  });

  test('returns default for unrecognized industry and title', () => {
    const lead = createLead({
      industry: 'xyz_unrecognized',
      title: 'Unknown Position',
    });
    const result = detectVertical(lead);

    expect(result.vertical).toBe(DEFAULT_VERTICAL);
    expect(result.confidence).toBe(0.1);
  });
});

// ===========================================
// Detection Priority
// ===========================================

describe('detectVertical - Priority order', () => {
  test('explicit vertical takes precedence over industry', () => {
    const lead = createLead({
      vertical: 'healthcare',
      industry: 'fintech',
      title: 'CFO', // Would normally map to iro
    });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('healthcare');
    expect(result.confidence).toBe(1.0);
  });

  test('industry takes precedence over title', () => {
    const lead = createLead({
      industry: 'fintech',
      title: 'Clinical Director', // Would normally map to healthcare
    });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('fintech');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('title takes precedence over default', () => {
    const lead = createLead({
      industry: 'unknown',
      title: 'VP of Engineering',
    });
    const result = detectVertical(lead);

    expect(result.vertical).toBe('saas');
    expect(result.confidence).toBe(0.5);
  });
});

// ===========================================
// Utility Functions
// ===========================================

describe('getAvailableVerticals', () => {
  test('returns all configured verticals', () => {
    const verticals = getAvailableVerticals();

    expect(verticals).toContain('iro');
    expect(verticals).toContain('fintech');
    expect(verticals).toContain('healthcare');
    expect(verticals).toContain('defense');
    expect(verticals).toContain('saas');
  });

  test('returns sorted array', () => {
    const verticals = getAvailableVerticals();
    const sorted = [...verticals].sort();

    expect(verticals).toEqual(sorted);
  });
});

describe('isVerticalSupported', () => {
  test('returns true for supported verticals', () => {
    expect(isVerticalSupported('iro')).toBe(true);
    expect(isVerticalSupported('fintech')).toBe(true);
  });

  test('returns false for unsupported verticals', () => {
    expect(isVerticalSupported('not_a_vertical')).toBe(false);
  });

  test('handles case-insensitive check', () => {
    // isVerticalSupported normalizes to lowercase, so case doesn't matter
    expect(isVerticalSupported('IRO')).toBe(true);
    expect(isVerticalSupported('iro')).toBe(true);
    expect(isVerticalSupported('Iro')).toBe(true);
  });
});

describe('getDetectionMethod', () => {
  test('returns correct method for confidence levels', () => {
    expect(getDetectionMethod(1.0)).toBe('explicit');
    expect(getDetectionMethod(0.9)).toBe('industry');
    expect(getDetectionMethod(0.7)).toBe('industry');
    expect(getDetectionMethod(0.5)).toBe('title');
    expect(getDetectionMethod(0.1)).toBe('default');
    expect(getDetectionMethod(0.0)).toBe('default');
  });
});

// ===========================================
// Edge Case: No Matching Vertical (T066)
// Per FR-002: Falls back to default brain (saas)
// ===========================================

describe('Edge case: no matching vertical fallback', () => {
  test('unknown industry returns default vertical as fallback', () => {
    const lead = createLead({
      industry: 'completely_unknown_industry',
      title: 'Random Position',
    });

    const result = detectVertical(lead);

    // Should fall back to default vertical (saas)
    // Per DEFAULT_VERTICAL in vertical-detector.ts
    expect(result.vertical).toBe('saas');
    expect(result.confidence).toBeLessThan(0.5);
  });

  test('lead with no industry or title falls back to default', () => {
    const lead = createLead({});

    const result = detectVertical(lead);

    // Falls back to DEFAULT_VERTICAL (saas)
    expect(result.vertical).toBe('saas');
    expect(result.confidence).toBeLessThan(0.5);
  });

  test('aerospace maps to defense vertical', () => {
    const lead = createLead({
      industry: 'aerospace',
    });

    const result = detectVertical(lead);

    // aerospace is in the defense vertical keywords
    expect(result.vertical).toBe('defense');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('default vertical (saas) is always supported', () => {
    expect(isVerticalSupported('saas')).toBe(true);
  });

  test('fallback detection method is "default"', () => {
    const lead = createLead({});
    const result = detectVertical(lead);

    if (result.confidence < 0.3) {
      expect(getDetectionMethod(result.confidence)).toBe('default');
    }
  });
});
