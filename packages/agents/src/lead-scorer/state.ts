/**
 * State Persistence Module
 *
 * Handles state persistence for batch processing and session handoff.
 * Enables batch resume after interruption per FR-015.
 *
 * State files are stored in state/lead-scorer-state.json
 *
 * @module lead-scorer/state
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BrainId } from '@atlas-gtm/lib';
import type {
  LeadScorerState,
  BatchProgress,
  ScoringDecision,
} from './types';
import type { ScoringResult } from './contracts/scoring-result';

// ===========================================
// Configuration
// ===========================================

/**
 * Default state directory relative to project root
 */
const DEFAULT_STATE_DIR = 'state';

/**
 * Default state filename
 */
const DEFAULT_STATE_FILENAME = 'lead-scorer-state.json';

/**
 * State persistence configuration
 */
export interface StateConfig {
  /** Directory to store state files */
  stateDir?: string;
  /** State filename */
  stateFilename?: string;
  /** Whether to create directory if missing */
  createDirIfMissing?: boolean;
}

const DEFAULT_STATE_CONFIG: StateConfig = {
  stateDir: DEFAULT_STATE_DIR,
  stateFilename: DEFAULT_STATE_FILENAME,
  createDirIfMissing: true,
};

// ===========================================
// Path Helpers
// ===========================================

/**
 * Get the state file path
 */
export function getStatePath(config: StateConfig = {}): string {
  const { stateDir, stateFilename } = { ...DEFAULT_STATE_CONFIG, ...config };
  return join(process.cwd(), stateDir!, stateFilename!);
}

/**
 * Ensure state directory exists
 */
export function ensureStateDir(config: StateConfig = {}): void {
  const { stateDir, createDirIfMissing } = { ...DEFAULT_STATE_CONFIG, ...config };
  const fullPath = join(process.cwd(), stateDir!);

  if (!existsSync(fullPath) && createDirIfMissing) {
    mkdirSync(fullPath, { recursive: true });
  }
}

// ===========================================
// State CRUD Operations
// ===========================================

/**
 * Load state from disk
 *
 * @returns The current state, or null if no state file exists
 */
export function loadState(config: StateConfig = {}): LeadScorerState | null {
  const statePath = getStatePath(config);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content) as LeadScorerState;
    return state;
  } catch (error) {
    // If file is corrupted, treat as no state
    console.warn('Failed to load state file, treating as no state:', error);
    return null;
  }
}

/**
 * Save state to disk
 *
 * @param state - The state to save
 */
export function saveState(state: LeadScorerState, config: StateConfig = {}): void {
  ensureStateDir(config);
  const statePath = getStatePath(config);

  // Update checkpoint timestamp
  const stateWithCheckpoint: LeadScorerState = {
    ...state,
    checkpoint_at: new Date().toISOString(),
  };

  writeFileSync(statePath, JSON.stringify(stateWithCheckpoint, null, 2), 'utf-8');
}

/**
 * Delete state file
 *
 * Typically called after batch processing completes successfully
 */
export function clearState(config: StateConfig = {}): void {
  const statePath = getStatePath(config);

  if (existsSync(statePath)) {
    unlinkSync(statePath);
  }
}

/**
 * Check if state file exists
 */
export function hasState(config: StateConfig = {}): boolean {
  return existsSync(getStatePath(config));
}

// ===========================================
// State Creation
// ===========================================

/**
 * Create a new state for batch processing
 *
 * @param sessionId - Unique session identifier
 * @param brainId - Brain ID being used
 * @param leadIds - Array of lead IDs to process
 */
export function createState(
  sessionId: string,
  brainId: BrainId,
  leadIds: string[]
): LeadScorerState {
  const now = new Date().toISOString();

  return {
    session_id: sessionId,
    brain_id: brainId,
    started_at: now,
    checkpoint_at: now,
    batch: {
      total_leads: leadIds.length,
      processed: 0,
      remaining_ids: [...leadIds],
    },
    decisions: [],
    learnings: [],
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ls_${timestamp}_${random}`;
}

// ===========================================
// Checkpoint Operations
// ===========================================

/**
 * Create a checkpoint snapshot from current state and recent results
 *
 * Call this at task boundaries (after each lead is scored)
 *
 * @param state - Current state
 * @param result - Most recent scoring result
 * @returns Updated state with checkpoint
 */
export function checkpoint(
  state: LeadScorerState,
  result: ScoringResult
): LeadScorerState {
  // Create lightweight decision record
  const decision: ScoringDecision = {
    lead_id: result.lead_id,
    score: result.score,
    tier: result.tier,
    angle: result.recommended_angle,
    timestamp: result.timestamp,
  };

  // Remove processed lead from remaining
  const newRemaining = state.batch.remaining_ids.filter(
    (id) => id !== result.lead_id
  );

  return {
    ...state,
    checkpoint_at: new Date().toISOString(),
    batch: {
      ...state.batch,
      processed: state.batch.processed + 1,
      remaining_ids: newRemaining,
    },
    decisions: [...state.decisions, decision],
  };
}

/**
 * Add a learning insight to state
 *
 * @param state - Current state
 * @param learning - Insight discovered during session
 * @returns Updated state with new learning
 */
export function addLearning(
  state: LeadScorerState,
  learning: string
): LeadScorerState {
  return {
    ...state,
    learnings: [...state.learnings, learning],
  };
}

// ===========================================
// Resume Operations
// ===========================================

/**
 * Check if batch can be resumed from existing state
 *
 * @returns Object with canResume flag and reason
 */
export function canResume(config: StateConfig = {}): {
  canResume: boolean;
  reason: string;
  state: LeadScorerState | null;
} {
  const state = loadState(config);

  if (!state) {
    return {
      canResume: false,
      reason: 'No existing state file found',
      state: null,
    };
  }

  // Check if there are remaining leads
  if (state.batch.remaining_ids.length === 0) {
    return {
      canResume: false,
      reason: 'All leads have been processed',
      state,
    };
  }

  // Check if state is stale (more than 24 hours old)
  const checkpointTime = new Date(state.checkpoint_at).getTime();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (now - checkpointTime > maxAge) {
    return {
      canResume: false,
      reason: 'State is stale (more than 24 hours old)',
      state,
    };
  }

  return {
    canResume: true,
    reason: `Can resume: ${state.batch.processed}/${state.batch.total_leads} processed, ${state.batch.remaining_ids.length} remaining`,
    state,
  };
}

/**
 * Get lead IDs to resume from existing state
 *
 * @returns Array of remaining lead IDs, or null if no resumable state
 */
export function resumeFrom(config: StateConfig = {}): {
  leadIds: string[];
  state: LeadScorerState;
} | null {
  const { canResume: resumable, state } = canResume(config);

  if (!resumable || !state) {
    return null;
  }

  return {
    leadIds: state.batch.remaining_ids,
    state,
  };
}

/**
 * Get batch progress statistics
 */
export function getProgress(state: LeadScorerState): {
  processed: number;
  remaining: number;
  total: number;
  percentage: number;
} {
  const { processed, total_leads, remaining_ids } = state.batch;

  return {
    processed,
    remaining: remaining_ids.length,
    total: total_leads,
    percentage: total_leads > 0 ? Math.round((processed / total_leads) * 100) : 0,
  };
}

/**
 * Get tier distribution from decisions
 */
export function getTierDistribution(
  state: LeadScorerState
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const decision of state.decisions) {
    distribution[decision.tier] = (distribution[decision.tier] || 0) + 1;
  }

  return distribution;
}

/**
 * Get elapsed time since batch started
 */
export function getElapsedTime(state: LeadScorerState): {
  ms: number;
  formatted: string;
} {
  const startTime = new Date(state.started_at).getTime();
  const now = Date.now();
  const ms = now - startTime;

  // Format as HH:MM:SS
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const formatted = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');

  return { ms, formatted };
}

// ===========================================
// State Validation
// ===========================================

/**
 * Validate state structure
 */
export function isValidState(state: unknown): state is LeadScorerState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const s = state as Record<string, unknown>;

  // Check required fields
  if (typeof s.session_id !== 'string') return false;
  if (typeof s.brain_id !== 'string') return false;
  if (typeof s.started_at !== 'string') return false;
  if (typeof s.checkpoint_at !== 'string') return false;

  // Check batch structure
  if (!s.batch || typeof s.batch !== 'object') return false;
  const batch = s.batch as Record<string, unknown>;
  if (typeof batch.total_leads !== 'number') return false;
  if (typeof batch.processed !== 'number') return false;
  if (!Array.isArray(batch.remaining_ids)) return false;

  // Check arrays
  if (!Array.isArray(s.decisions)) return false;
  if (!Array.isArray(s.learnings)) return false;

  return true;
}

/**
 * Repair corrupted state if possible
 */
export function repairState(
  state: Partial<LeadScorerState>,
  brainId?: BrainId
): LeadScorerState | null {
  // Can't repair without session_id and brain_id
  if (!state.session_id) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    session_id: state.session_id,
    brain_id: state.brain_id || brainId || ('unknown' as BrainId),
    started_at: state.started_at || now,
    checkpoint_at: state.checkpoint_at || now,
    batch: {
      total_leads: state.batch?.total_leads || 0,
      processed: state.batch?.processed || 0,
      remaining_ids: state.batch?.remaining_ids || [],
    },
    decisions: state.decisions || [],
    learnings: state.learnings || [],
  };
}
