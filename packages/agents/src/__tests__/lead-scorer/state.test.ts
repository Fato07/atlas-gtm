/**
 * State Persistence Tests
 *
 * Tests for FR-015: State persistence for session handoff
 * Tests for US6: Batch resume after interruption
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync as fsWriteFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrainId } from '@atlas-gtm/lib';
import {
  getStatePath,
  ensureStateDir,
  loadState,
  saveState,
  clearState,
  hasState,
  createState,
  generateSessionId,
  checkpoint,
  addLearning,
  canResume,
  resumeFrom,
  getProgress,
  getTierDistribution,
  getElapsedTime,
  isValidState,
  repairState,
  type StateConfig,
} from '../../lead-scorer/state';
import type { LeadScorerState } from '../../lead-scorer/types';
import type { ScoringResult } from '../../lead-scorer/contracts/scoring-result';

// ===========================================
// Test Helpers
// ===========================================

const TEST_STATE_DIR = 'test-state-temp';
const TEST_STATE_FILENAME = 'test-lead-scorer-state.json';

const testConfig: StateConfig = {
  stateDir: TEST_STATE_DIR,
  stateFilename: TEST_STATE_FILENAME,
  createDirIfMissing: true,
};

function createTestState(overrides: Partial<LeadScorerState> = {}): LeadScorerState {
  const now = new Date().toISOString();
  return {
    session_id: 'test_session_001',
    brain_id: 'brain_fintech_v1' as BrainId,
    started_at: now,
    checkpoint_at: now,
    batch: {
      total_leads: 10,
      processed: 3,
      remaining_ids: ['lead_4', 'lead_5', 'lead_6', 'lead_7', 'lead_8', 'lead_9', 'lead_10'],
    },
    decisions: [
      { lead_id: 'lead_1', score: 75, tier: 'priority', angle: 'technical', timestamp: now },
      { lead_id: 'lead_2', score: 55, tier: 'qualified', angle: 'roi', timestamp: now },
      { lead_id: 'lead_3', score: 25, tier: 'disqualified', timestamp: now },
    ],
    learnings: [],
    ...overrides,
  };
}

function createTestScoringResult(overrides: Partial<ScoringResult> = {}): ScoringResult {
  return {
    lead_id: 'lead_new',
    score: 65,
    tier: 'qualified',
    scoring_breakdown: [],
    recommended_angle: 'technical',
    personalization_hints: [],
    vertical_detected: 'fintech',
    brain_used: 'brain_fintech_v1',
    processing_time_ms: 50,
    rules_evaluated: 4,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function cleanupTestDir(): void {
  const testDir = join(process.cwd(), TEST_STATE_DIR);
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
}

// ===========================================
// Setup / Teardown
// ===========================================

beforeEach(() => {
  cleanupTestDir();
});

afterEach(() => {
  cleanupTestDir();
});

// ===========================================
// Path Helper Tests
// ===========================================

describe('getStatePath', () => {
  test('returns path with custom config', () => {
    const path = getStatePath(testConfig);
    expect(path).toContain(TEST_STATE_DIR);
    expect(path).toContain(TEST_STATE_FILENAME);
  });

  test('returns path with default config', () => {
    const path = getStatePath();
    expect(path).toContain('state');
    expect(path).toContain('lead-scorer-state.json');
  });
});

describe('ensureStateDir', () => {
  test('creates directory if missing', () => {
    const testDir = join(process.cwd(), TEST_STATE_DIR);
    expect(existsSync(testDir)).toBe(false);

    ensureStateDir(testConfig);

    expect(existsSync(testDir)).toBe(true);
  });

  test('does not throw if directory exists', () => {
    const testDir = join(process.cwd(), TEST_STATE_DIR);
    mkdirSync(testDir, { recursive: true });

    expect(() => ensureStateDir(testConfig)).not.toThrow();
  });
});

// ===========================================
// State CRUD Tests
// ===========================================

describe('saveState', () => {
  test('saves state to disk', () => {
    const state = createTestState();
    saveState(state, testConfig);

    const path = getStatePath(testConfig);
    expect(existsSync(path)).toBe(true);
  });

  test('creates directory if needed', () => {
    const state = createTestState();
    saveState(state, testConfig);

    const testDir = join(process.cwd(), TEST_STATE_DIR);
    expect(existsSync(testDir)).toBe(true);
  });

  test('updates checkpoint_at timestamp', () => {
    const oldTime = '2020-01-01T00:00:00.000Z';
    const state = createTestState({ checkpoint_at: oldTime });

    saveState(state, testConfig);
    const loaded = loadState(testConfig);

    expect(loaded).not.toBeNull();
    expect(loaded!.checkpoint_at).not.toBe(oldTime);
    expect(new Date(loaded!.checkpoint_at).getTime()).toBeGreaterThan(new Date(oldTime).getTime());
  });
});

describe('loadState', () => {
  test('returns null when no state file', () => {
    const state = loadState(testConfig);
    expect(state).toBeNull();
  });

  test('loads saved state', () => {
    const original = createTestState();
    saveState(original, testConfig);

    const loaded = loadState(testConfig);

    expect(loaded).not.toBeNull();
    expect(loaded!.session_id).toBe(original.session_id);
    expect(loaded!.brain_id).toBe(original.brain_id);
    expect(loaded!.batch.processed).toBe(original.batch.processed);
  });

  test('returns null for corrupted file', () => {
    const path = getStatePath(testConfig);
    ensureStateDir(testConfig);
    fsWriteFileSync(path, 'not valid json {{{', 'utf-8');

    const state = loadState(testConfig);
    expect(state).toBeNull();
  });
});

describe('clearState', () => {
  test('removes state file', () => {
    const state = createTestState();
    saveState(state, testConfig);

    expect(hasState(testConfig)).toBe(true);

    clearState(testConfig);

    expect(hasState(testConfig)).toBe(false);
  });

  test('does not throw if no state file', () => {
    expect(() => clearState(testConfig)).not.toThrow();
  });
});

describe('hasState', () => {
  test('returns false when no state', () => {
    expect(hasState(testConfig)).toBe(false);
  });

  test('returns true when state exists', () => {
    const state = createTestState();
    saveState(state, testConfig);

    expect(hasState(testConfig)).toBe(true);
  });
});

// ===========================================
// State Creation Tests
// ===========================================

describe('createState', () => {
  test('creates state with provided values', () => {
    const leadIds = ['lead_1', 'lead_2', 'lead_3'];
    const state = createState('session_001', 'brain_iro_v1' as BrainId, leadIds);

    expect(state.session_id).toBe('session_001');
    expect(state.brain_id).toBe('brain_iro_v1');
    expect(state.batch.total_leads).toBe(3);
    expect(state.batch.processed).toBe(0);
    expect(state.batch.remaining_ids).toEqual(leadIds);
    expect(state.decisions).toEqual([]);
    expect(state.learnings).toEqual([]);
  });

  test('sets timestamps to now', () => {
    const before = Date.now();
    const state = createState('session_001', 'brain_iro_v1' as BrainId, []);
    const after = Date.now();

    const startedAt = new Date(state.started_at).getTime();
    const checkpointAt = new Date(state.checkpoint_at).getTime();

    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(after);
    expect(checkpointAt).toBe(startedAt);
  });
});

describe('generateSessionId', () => {
  test('generates unique IDs', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();

    expect(id1).not.toBe(id2);
  });

  test('starts with ls_ prefix', () => {
    const id = generateSessionId();
    expect(id.startsWith('ls_')).toBe(true);
  });

  test('contains timestamp and random parts', () => {
    const id = generateSessionId();
    const parts = id.split('_');

    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('ls');
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });
});

// ===========================================
// Checkpoint Tests
// ===========================================

describe('checkpoint', () => {
  test('adds decision to state', () => {
    const state = createTestState({
      batch: {
        total_leads: 5,
        processed: 0,
        remaining_ids: ['lead_1', 'lead_2', 'lead_3', 'lead_4', 'lead_5'],
      },
      decisions: [],
    });

    const result = createTestScoringResult({ lead_id: 'lead_1' });
    const updated = checkpoint(state, result);

    expect(updated.decisions).toHaveLength(1);
    expect(updated.decisions[0].lead_id).toBe('lead_1');
    expect(updated.decisions[0].score).toBe(result.score);
    expect(updated.decisions[0].tier).toBe(result.tier);
    expect(updated.decisions[0].angle).toBe(result.recommended_angle);
  });

  test('removes processed lead from remaining', () => {
    const state = createTestState({
      batch: {
        total_leads: 3,
        processed: 0,
        remaining_ids: ['lead_1', 'lead_2', 'lead_3'],
      },
    });

    const result = createTestScoringResult({ lead_id: 'lead_2' });
    const updated = checkpoint(state, result);

    expect(updated.batch.remaining_ids).not.toContain('lead_2');
    expect(updated.batch.remaining_ids).toEqual(['lead_1', 'lead_3']);
  });

  test('increments processed count', () => {
    const state = createTestState({
      batch: {
        total_leads: 5,
        processed: 2,
        remaining_ids: ['lead_3', 'lead_4', 'lead_5'],
      },
    });

    const result = createTestScoringResult({ lead_id: 'lead_3' });
    const updated = checkpoint(state, result);

    expect(updated.batch.processed).toBe(3);
  });

  test('updates checkpoint timestamp', () => {
    const oldTime = '2020-01-01T00:00:00.000Z';
    const state = createTestState({ checkpoint_at: oldTime });

    const result = createTestScoringResult({ lead_id: 'lead_4' });
    const updated = checkpoint(state, result);

    expect(updated.checkpoint_at).not.toBe(oldTime);
  });
});

describe('addLearning', () => {
  test('adds learning to state', () => {
    const state = createTestState({ learnings: [] });

    const updated = addLearning(state, 'Fintech companies respond best to compliance angle');

    expect(updated.learnings).toHaveLength(1);
    expect(updated.learnings[0]).toBe('Fintech companies respond best to compliance angle');
  });

  test('preserves existing learnings', () => {
    const state = createTestState({ learnings: ['First learning'] });

    const updated = addLearning(state, 'Second learning');

    expect(updated.learnings).toHaveLength(2);
    expect(updated.learnings[0]).toBe('First learning');
    expect(updated.learnings[1]).toBe('Second learning');
  });
});

// ===========================================
// Resume Tests
// ===========================================

describe('canResume', () => {
  test('returns false when no state file', () => {
    const result = canResume(testConfig);

    expect(result.canResume).toBe(false);
    expect(result.reason).toContain('No existing state');
    expect(result.state).toBeNull();
  });

  test('returns false when all leads processed', () => {
    const state = createTestState({
      batch: {
        total_leads: 3,
        processed: 3,
        remaining_ids: [],
      },
    });
    saveState(state, testConfig);

    const result = canResume(testConfig);

    expect(result.canResume).toBe(false);
    expect(result.reason).toContain('All leads have been processed');
  });

  test('returns false when state is stale', () => {
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
    const state = createTestState({ checkpoint_at: oldTime });

    // Write state directly to file to avoid saveState updating checkpoint_at
    ensureStateDir(testConfig);
    const path = getStatePath(testConfig);
    fsWriteFileSync(path, JSON.stringify(state, null, 2), 'utf-8');

    const result = canResume(testConfig);

    expect(result.canResume).toBe(false);
    expect(result.reason).toContain('stale');
  });

  test('returns true when resumable', () => {
    const state = createTestState();
    saveState(state, testConfig);

    const result = canResume(testConfig);

    expect(result.canResume).toBe(true);
    expect(result.reason).toContain('Can resume');
    expect(result.state).not.toBeNull();
  });
});

describe('resumeFrom', () => {
  test('returns null when not resumable', () => {
    const result = resumeFrom(testConfig);
    expect(result).toBeNull();
  });

  test('returns remaining lead IDs when resumable', () => {
    const remainingIds = ['lead_5', 'lead_6', 'lead_7'];
    const state = createTestState({
      batch: {
        total_leads: 7,
        processed: 4,
        remaining_ids: remainingIds,
      },
    });
    saveState(state, testConfig);

    const result = resumeFrom(testConfig);

    expect(result).not.toBeNull();
    expect(result!.leadIds).toEqual(remainingIds);
    expect(result!.state.session_id).toBe(state.session_id);
  });
});

// ===========================================
// Progress Helper Tests
// ===========================================

describe('getProgress', () => {
  test('calculates progress correctly', () => {
    const state = createTestState({
      batch: {
        total_leads: 100,
        processed: 25,
        remaining_ids: Array(75).fill('lead'),
      },
    });

    const progress = getProgress(state);

    expect(progress.processed).toBe(25);
    expect(progress.remaining).toBe(75);
    expect(progress.total).toBe(100);
    expect(progress.percentage).toBe(25);
  });

  test('handles zero total leads', () => {
    const state = createTestState({
      batch: {
        total_leads: 0,
        processed: 0,
        remaining_ids: [],
      },
    });

    const progress = getProgress(state);

    expect(progress.percentage).toBe(0);
  });
});

describe('getTierDistribution', () => {
  test('calculates tier distribution', () => {
    const state = createTestState({
      decisions: [
        { lead_id: 'l1', score: 80, tier: 'priority', timestamp: '' },
        { lead_id: 'l2', score: 75, tier: 'priority', timestamp: '' },
        { lead_id: 'l3', score: 55, tier: 'qualified', timestamp: '' },
        { lead_id: 'l4', score: 35, tier: 'nurture', timestamp: '' },
        { lead_id: 'l5', score: 10, tier: 'disqualified', timestamp: '' },
      ],
    });

    const distribution = getTierDistribution(state);

    expect(distribution.priority).toBe(2);
    expect(distribution.qualified).toBe(1);
    expect(distribution.nurture).toBe(1);
    expect(distribution.disqualified).toBe(1);
  });

  test('handles empty decisions', () => {
    const state = createTestState({ decisions: [] });

    const distribution = getTierDistribution(state);

    expect(Object.keys(distribution)).toHaveLength(0);
  });
});

describe('getElapsedTime', () => {
  test('calculates elapsed time', () => {
    const startTime = new Date(Date.now() - 3661000).toISOString(); // 1h 1m 1s ago
    const state = createTestState({ started_at: startTime });

    const elapsed = getElapsedTime(state);

    expect(elapsed.ms).toBeGreaterThanOrEqual(3660000);
    expect(elapsed.formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(elapsed.formatted).toBe('01:01:01');
  });
});

// ===========================================
// Validation Tests
// ===========================================

describe('isValidState', () => {
  test('returns true for valid state', () => {
    const state = createTestState();
    expect(isValidState(state)).toBe(true);
  });

  test('returns false for null', () => {
    expect(isValidState(null)).toBe(false);
  });

  test('returns false for missing session_id', () => {
    const state = createTestState();
    delete (state as any).session_id;
    expect(isValidState(state)).toBe(false);
  });

  test('returns false for missing batch', () => {
    const state = createTestState();
    delete (state as any).batch;
    expect(isValidState(state)).toBe(false);
  });

  test('returns false for non-array decisions', () => {
    const state = createTestState();
    (state as any).decisions = 'not an array';
    expect(isValidState(state)).toBe(false);
  });
});

describe('repairState', () => {
  test('repairs state with missing fields', () => {
    const partial: Partial<LeadScorerState> = {
      session_id: 'session_001',
      brain_id: 'brain_test_v1' as BrainId,
    };

    const repaired = repairState(partial);

    expect(repaired).not.toBeNull();
    expect(repaired!.session_id).toBe('session_001');
    expect(repaired!.batch.total_leads).toBe(0);
    expect(repaired!.decisions).toEqual([]);
    expect(repaired!.learnings).toEqual([]);
  });

  test('returns null when session_id is missing', () => {
    const partial: Partial<LeadScorerState> = {
      brain_id: 'brain_test_v1' as BrainId,
    };

    const repaired = repairState(partial);

    expect(repaired).toBeNull();
  });

  test('uses provided brainId as fallback', () => {
    const partial: Partial<LeadScorerState> = {
      session_id: 'session_001',
    };

    const repaired = repairState(partial, 'brain_fallback_v1' as BrainId);

    expect(repaired).not.toBeNull();
    expect(repaired!.brain_id).toBe('brain_fallback_v1');
  });
});

// ===========================================
// Integration Tests
// ===========================================

describe('State persistence integration', () => {
  test('full save/load/checkpoint cycle', () => {
    // Create initial state
    const leadIds = ['lead_1', 'lead_2', 'lead_3', 'lead_4', 'lead_5'];
    const state = createState('session_001', 'brain_fintech_v1' as BrainId, leadIds);
    saveState(state, testConfig);

    // Simulate processing leads
    let currentState = loadState(testConfig)!;

    for (let i = 0; i < 3; i++) {
      const leadId = currentState.batch.remaining_ids[0];
      const result = createTestScoringResult({
        lead_id: leadId,
        score: 50 + i * 10,
        tier: i === 0 ? 'priority' : 'qualified',
      });

      currentState = checkpoint(currentState, result);
      saveState(currentState, testConfig);
    }

    // Verify state
    const finalState = loadState(testConfig)!;
    expect(finalState.batch.processed).toBe(3);
    expect(finalState.batch.remaining_ids).toHaveLength(2);
    expect(finalState.decisions).toHaveLength(3);

    // Verify resumability
    const { canResume: resumable, state: resumeState } = canResume(testConfig);
    expect(resumable).toBe(true);
    expect(resumeState!.batch.remaining_ids).toEqual(['lead_4', 'lead_5']);
  });

  test('resume after interruption', () => {
    // Simulate interrupted batch
    const state = createTestState({
      session_id: 'interrupted_session',
      batch: {
        total_leads: 10,
        processed: 6,
        remaining_ids: ['lead_7', 'lead_8', 'lead_9', 'lead_10'],
      },
      decisions: [
        { lead_id: 'lead_1', score: 80, tier: 'priority', timestamp: '' },
        { lead_id: 'lead_2', score: 60, tier: 'qualified', timestamp: '' },
        { lead_id: 'lead_3', score: 70, tier: 'priority', timestamp: '' },
        { lead_id: 'lead_4', score: 45, tier: 'nurture', timestamp: '' },
        { lead_id: 'lead_5', score: 55, tier: 'qualified', timestamp: '' },
        { lead_id: 'lead_6', score: 20, tier: 'disqualified', timestamp: '' },
      ],
    });
    saveState(state, testConfig);

    // Attempt resume
    const resume = resumeFrom(testConfig);

    expect(resume).not.toBeNull();
    expect(resume!.leadIds).toEqual(['lead_7', 'lead_8', 'lead_9', 'lead_10']);
    expect(resume!.state.decisions).toHaveLength(6);
  });

  test('clear state after completion', () => {
    const state = createTestState();
    saveState(state, testConfig);

    expect(hasState(testConfig)).toBe(true);

    // Complete processing
    clearState(testConfig);

    expect(hasState(testConfig)).toBe(false);
    expect(canResume(testConfig).canResume).toBe(false);
  });
});
