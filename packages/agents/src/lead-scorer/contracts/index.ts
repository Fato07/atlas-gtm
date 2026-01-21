/**
 * Lead Scorer Contracts
 *
 * Re-exports all contract types and schemas.
 *
 * @module contracts
 */

export * from './lead-input';
export * from './scoring-result';
export * from './webhook-api';

// Structured output tool contracts
export {
  // Schemas
  AngleRecommendationSchema,
  // Types
  type AngleRecommendation,
  type AngleToolInput,
  // Tool
  ANGLE_TOOL,
} from './angle-tool';
