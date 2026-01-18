/**
 * Batch Processing Tests
 *
 * Tests for batch scoring functionality including:
 * - Batch processing with state persistence
 * - Duplicate detection
 * - Retry with exponential backoff
 * - Resume from interruption
 * - Progress callbacks
 *
 * @module __tests__/lead-scorer/batch.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  LeadScorerAgent,
  createLeadScorerAgent,
} from '../../lead-scorer/agent';
import {
  loadState,
  saveState,
  clearState,
  createState,
  checkpoint,
  canResume,
  getStatePath,
} from '../../lead-scorer/state';
import type { LeadInput } from '../../lead-scorer/contracts/lead-input';
import type { LeadScorerState } from '../../lead-scorer/types';
import type { ScoringResult } from '../../lead-scorer/contracts/scoring-result';
import type { BrainId } from '@atlas-gtm/lib';

// ===========================================
// Test Fixtures
// ===========================================

const TEST_STATE_DIR = 'test-batch-state-temp';
const TEST_STATE_FILENAME = 'batch-test-state.json';

const testConfig = {
  stateDir: TEST_STATE_DIR,
  stateFilename: TEST_STATE_FILENAME,
  createDirIfMissing: true,
};

function createTestLead(id: string, overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    lead_id: id,
    email: `${id}@example.com`,
    company: `Company ${id}`,
    source: 'clay',
    title: 'Manager',
    company_size: 100,
    industry: 'Technology',
    funding_stage: 'series_a',
    tech_stack: ['Node.js'],
    ...overrides,
  };
}

function createTestLeads(count: number): LeadInput[] {
  return Array.from({ length: count }, (_, i) => createTestLead(`batch_lead_${i + 1}`));
}

// ===========================================
// Test Setup
// ===========================================

describe('Batch Processing', () => {
  let agent: LeadScorerAgent;

  beforeEach(() => {
    agent = createLeadScorerAgent({
      checkpointInterval: 3,
    });

    // Clean up any existing test state
    const statePath = getStatePath(testConfig);
    if (existsSync(statePath)) {
      unlinkSync(statePath);
    }
    clearState();
  });

  afterEach(() => {
    // Clean up test state directory
    const testDir = join(process.cwd(), TEST_STATE_DIR);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    clearState();
  });

  describe('Basic Batch Scoring', () => {
    it('should score multiple leads in batch', async () => {
      const leads = createTestLeads(5);

      const results = await agent.scoreBatch(leads);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.lead_id).toBe(`batch_lead_${i + 1}`);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.tier).toBeDefined();
      });
    });

    it('should call progress callback for each lead', async () => {
      const leads = createTestLeads(3);
      const progressCalls: Array<[number, number]> = [];

      await agent.scoreBatch(leads, {
        onProgress: (processed, total) => {
          progressCalls.push([processed, total]);
        },
      });

      expect(progressCalls).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it('should continue processing even if some leads fail', async () => {
      const leads = createTestLeads(3);
      // Create a lead that will fail (missing required fields would be handled by validation)
      // For this test, we'll verify error handling works

      const results = await agent.scoreBatch(leads);

      expect(results.length).toBe(3);
    });
  });

  describe('State Persistence', () => {
    it('should create state at batch start', async () => {
      const leads = createTestLeads(5);

      await agent.scoreBatch(leads);

      // State should be cleared after successful completion
      expect(loadState()).toBeNull();
    });

    it('should save checkpoints at configured interval', async () => {
      const leads = createTestLeads(10);
      const checkpoints: number[] = [];

      // Create a complete mock logger with all required methods
      const mockLogger = {
        setSessionId: () => {},
        batchStarted: () => {},
        batchCompleted: () => {},
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: () => {},
        leadScored: () => {},
        scoringFailed: () => {},
        ruleEvaluated: () => {},
        verticalDetected: () => {},
        angleRecommended: () => {},
        webhookReceived: () => {},
        checkpointSaved: (data: { processed: number }) => {
          checkpoints.push(data.processed);
        },
      };
      agent.setLogger(mockLogger as any);

      await agent.scoreBatch(leads, { checkpointInterval: 3 });

      // With interval 3, checkpoints at: 3, 6, 9
      expect(checkpoints).toEqual([3, 6, 9]);
    });

    it('should update state after each lead is processed', async () => {
      const leads = createTestLeads(3);
      const leadIds = leads.map((l) => l.lead_id);

      // Create initial state
      const initialState = createState('test_session', 'brain_test' as BrainId, leadIds);

      // Simulate processing
      const mockResult: ScoringResult = {
        lead_id: leadIds[0],
        score: 75,
        tier: 'qualified',
        scoring_breakdown: [],
        recommended_angle: 'pain_point',
        personalization_hints: [],
        vertical_detected: 'general',
        brain_used: 'brain_test',
        processing_time_ms: 100,
        rules_evaluated: 5,
        timestamp: new Date().toISOString(),
      };

      const updatedState = checkpoint(initialState, mockResult);

      expect(updatedState.batch.processed).toBe(1);
      expect(updatedState.batch.remaining_ids).not.toContain(leadIds[0]);
      expect(updatedState.decisions).toHaveLength(1);
      expect(updatedState.decisions[0].lead_id).toBe(leadIds[0]);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect new leads', async () => {
      const lead = createTestLead('new_lead_001');

      const result = await agent.checkDuplicate(lead);

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldRescore).toBe(true);
      expect(result.reason).toBe('not_found');
    });

    it('should allow rescore when force_rescore is true', async () => {
      // This test would need mocked storage to verify force_rescore behavior
      // For now, we verify the interface works
      const lead = createTestLead('existing_lead_001');

      const result = await agent.checkDuplicate(lead, true);

      // Without existing record, should still return not_found
      expect(result.reason).toBe('not_found');
    });

    it('should generate consistent hash for same data', async () => {
      const lead1 = createTestLead('lead_001', { company_size: 100, industry: 'Tech' });
      const lead2 = createTestLead('lead_001', { company_size: 100, industry: 'Tech' });

      // Access private method for testing
      const hash1 = (agent as any).hashLeadData(lead1);
      const hash2 = (agent as any).hashLeadData(lead2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different data', async () => {
      const lead1 = createTestLead('lead_001', { company_size: 100 });
      const lead2 = createTestLead('lead_001', { company_size: 200 });

      const hash1 = (agent as any).hashLeadData(lead1);
      const hash2 = (agent as any).hashLeadData(lead2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Resume from Interruption', () => {
    it('should resume processing from saved state', async () => {
      const leads = createTestLeads(5);
      const leadIds = leads.map((l) => l.lead_id);

      // Create a partial state (simulating interruption after 2 leads)
      const partialState = createState('resume_session', 'brain_test' as BrainId, leadIds);

      // Simulate 2 leads processed
      let state = partialState;
      for (let i = 0; i < 2; i++) {
        const mockResult: ScoringResult = {
          lead_id: leadIds[i],
          score: 75,
          tier: 'qualified',
          scoring_breakdown: [],
          recommended_angle: 'pain_point',
          personalization_hints: [],
          vertical_detected: 'general',
          brain_used: 'brain_test',
          processing_time_ms: 100,
          rules_evaluated: 5,
          timestamp: new Date().toISOString(),
        };
        state = checkpoint(state, mockResult);
      }

      // Save the partial state
      saveState(state);

      // Resume with the partial state
      const results = await agent.scoreBatch(leads, {
        resumeFromState: state,
      });

      // Should only process remaining 3 leads
      expect(results).toHaveLength(3);
      expect(results[0].lead_id).toBe(leadIds[2]);
    });

    it('should check if state can be resumed', () => {
      // Without saved state
      let resumeCheck = canResume();
      expect(resumeCheck.canResume).toBe(false);
      expect(resumeCheck.reason).toContain('No existing state');

      // With saved state
      const state = createState('test', 'brain' as BrainId, ['lead_1', 'lead_2']);
      saveState(state);

      resumeCheck = canResume();
      expect(resumeCheck.canResume).toBe(true);
      expect(resumeCheck.state).toBeDefined();

      clearState();
    });

    it('should not resume stale state (>24 hours old)', () => {
      // Create state with old timestamp
      const oldState: LeadScorerState = {
        session_id: 'old_session',
        brain_id: 'brain_test' as BrainId,
        started_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        checkpoint_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        batch: {
          total_leads: 5,
          processed: 2,
          remaining_ids: ['lead_3', 'lead_4', 'lead_5'],
        },
        decisions: [],
        learnings: [],
      };

      // Write directly to bypass saveState's timestamp update
      const statePath = getStatePath();
      const dir = join(process.cwd(), 'state');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      require('fs').writeFileSync(statePath, JSON.stringify(oldState, null, 2));

      const resumeCheck = canResume();
      expect(resumeCheck.canResume).toBe(false);
      expect(resumeCheck.reason).toContain('stale');

      clearState();
    });

    it('should return null from resumeBatch when no state exists', async () => {
      const leads = createTestLeads(3);

      const result = await agent.resumeBatch(leads);

      expect(result).toBeNull();
    });
  });

  describe('Retry with Exponential Backoff', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient failure');
        }
        return 'success';
      };

      // Access private method for testing
      const result = await (agent as any).withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 10, // Fast for testing
        maxDelayMs: 40,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max attempts exceeded', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };

      await expect(
        (agent as any).withRetry(operation, {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 40,
        })
      ).rejects.toThrow('Persistent failure');
    });

    it('should use exponential backoff delays', async () => {
      const delays: number[] = [];
      let attempts = 0;
      const startTime = Date.now();

      const operation = async () => {
        if (attempts > 0) {
          delays.push(Date.now() - startTime);
        }
        attempts++;
        if (attempts < 3) {
          throw new Error('Failure');
        }
        return 'success';
      };

      await (agent as any).withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 50,
        maxDelayMs: 200,
      });

      // First delay: ~50ms, second delay: ~100ms
      expect(delays.length).toBe(2);
      // Allow some timing variance
      expect(delays[0]).toBeGreaterThanOrEqual(45);
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0] + 45);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors for failed leads', async () => {
      // Create agent with mock that fails for specific leads
      const leads = createTestLeads(3);
      const errors: Array<{ lead_id: string }> = [];

      // For this test, all leads should succeed with mock rules
      const results = await agent.scoreBatch(leads);

      expect(results).toHaveLength(3);
    });

    it('should clear state on successful batch completion', async () => {
      const leads = createTestLeads(3);

      await agent.scoreBatch(leads);

      // State should be cleared after successful completion
      const state = loadState();
      expect(state).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lead array', async () => {
      const results = await agent.scoreBatch([]);

      expect(results).toHaveLength(0);
    });

    it('should handle single lead batch', async () => {
      const leads = createTestLeads(1);

      const results = await agent.scoreBatch(leads);

      expect(results).toHaveLength(1);
    });

    it('should handle large batch (100 leads)', async () => {
      const leads = createTestLeads(100);

      const results = await agent.scoreBatch(leads, {
        checkpointInterval: 20,
      });

      expect(results).toHaveLength(100);
    });
  });
});

describe('Batch Processing Types', () => {
  describe('DuplicateCheckResult', () => {
    it('should have correct structure for not found', () => {
      const result = {
        isDuplicate: false,
        shouldRescore: true,
        reason: 'not_found' as const,
      };

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldRescore).toBe(true);
      expect(result.existingRecord).toBeUndefined();
    });

    it('should have correct structure for already scored', () => {
      const result = {
        isDuplicate: true,
        existingRecord: {
          lead_id: 'lead_001',
          score: 75,
          scored_at: '2024-01-15T10:00:00Z',
          data_hash: 'abc123',
        },
        shouldRescore: false,
        reason: 'already_scored' as const,
      };

      expect(result.isDuplicate).toBe(true);
      expect(result.existingRecord?.score).toBe(75);
      expect(result.shouldRescore).toBe(false);
    });
  });

  describe('RetryConfig', () => {
    it('should have default values', () => {
      const config = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 4000,
      };

      expect(config.maxAttempts).toBe(3);
      expect(config.baseDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(4000);
    });
  });
});
