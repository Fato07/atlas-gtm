/**
 * Lead Scorer Agent
 *
 * Evaluates leads against ICP rules, detects verticals,
 * calculates scores/tiers, and recommends messaging angles.
 *
 * @module lead-scorer
 */

// === Contracts (API boundaries) ===
export * from './contracts/lead-input';
export * from './contracts/scoring-result';
export * from './contracts/webhook-api';

// === Types (internal) ===
export * from './types';

// === Core Modules ===
export * from './vertical-detector';
export * from './rules';
export * from './scoring';
export * from './angles';
export * from './logger';
export * from './state';

// === Agent ===
export { LeadScorerAgent, createLeadScorerAgent } from './agent';

// === Webhook Handler ===
export * from './webhook';
