/**
 * Webhook Handler Tests
 *
 * Tests for the webhook endpoint handler including:
 * - Authentication validation
 * - Request validation
 * - Lead scoring via webhook
 * - Error handling
 * - Timeout handling
 * - Duplicate detection
 *
 * @module __tests__/lead-scorer/webhook.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebhookHandler,
  createWebhookHandler,
  createBunHandler,
  TimeoutError,
  BrainNotFoundError,
  WEBHOOK_SECRET_HEADER,
  HTTP_STATUS,
  validateWebhookAuth,
  validateWebhookRequest,
  buildSuccessResponse,
  buildErrorResponse,
  buildSkippedResponse,
} from '../../lead-scorer/webhook';
import type { WebhookHandlerConfig, IncomingRequest } from '../../lead-scorer/webhook';
import type { WebhookRequest } from '../../lead-scorer/contracts/webhook-api';
import type { LeadInput } from '../../lead-scorer/contracts/lead-input';

// ===========================================
// Test Fixtures
// ===========================================

const TEST_SECRET = 'test-webhook-secret-123';

const validLeadInput: LeadInput = {
  lead_id: 'lead_webhook_test_001',
  email: 'test@company.com',
  first_name: 'John',
  last_name: 'Doe',
  company: 'Test Corp',
  source: 'clay',
  title: 'VP Engineering',
  company_size: 150,
  industry: 'Technology',
  funding_stage: 'series_b',
};

const validWebhookRequest: WebhookRequest = {
  ...validLeadInput,
  force_rescore: false,
};

function createMockRequest(
  body: unknown,
  secret?: string | null
): IncomingRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret !== null) {
    headers[WEBHOOK_SECRET_HEADER] = secret ?? TEST_SECRET;
  }

  return {
    headers,
    body,
  };
}

function createConfig(
  overrides: Partial<WebhookHandlerConfig> = {}
): WebhookHandlerConfig {
  return {
    webhookSecret: TEST_SECRET,
    timeoutMs: 5000,
    ...overrides,
  };
}

// ===========================================
// Test Suites
// ===========================================

describe('Webhook Handler', () => {
  describe('WebhookHandler class', () => {
    let handler: WebhookHandler;

    beforeEach(() => {
      handler = createWebhookHandler(createConfig());
    });

    describe('Authentication', () => {
      it('should reject request without X-Webhook-Secret header', async () => {
        const request = createMockRequest(validWebhookRequest, null);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: `Missing ${WEBHOOK_SECRET_HEADER} header`,
          },
        });
      });

      it('should reject request with invalid secret', async () => {
        const request = createMockRequest(validWebhookRequest, 'wrong-secret');

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Invalid webhook secret',
          },
        });
      });

      it('should accept request with valid secret', async () => {
        const request = createMockRequest(validWebhookRequest, TEST_SECRET);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
        expect(response.body).toHaveProperty('success', true);
      });

      it('should work with Headers object', async () => {
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        headers.set(WEBHOOK_SECRET_HEADER, TEST_SECRET);

        const request: IncomingRequest = {
          headers,
          body: validWebhookRequest,
        };

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
      });
    });

    describe('Request Validation', () => {
      it('should reject request with missing lead_id', async () => {
        const invalidBody = { ...validWebhookRequest };
        delete (invalidBody as any).lead_id;

        const request = createMockRequest(invalidBody);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Request validation failed',
          },
        });
      });

      it('should reject request with invalid email format', async () => {
        const invalidBody = {
          ...validWebhookRequest,
          email: 'not-an-email',
        };

        const request = createMockRequest(invalidBody);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_INPUT',
          },
        });
      });

      it('should accept request with minimal valid fields', async () => {
        const minimalBody = {
          lead_id: 'lead_minimal_001',
          email: 'test@example.com',
          company: 'Test Co',
          source: 'website',
          title: 'Manager',
          company_size: 100,
          industry: 'Technology',
          funding_stage: 'series_a',
          tech_stack: ['Node.js'],
        };

        const request = createMockRequest(minimalBody);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
      });

      it('should accept force_rescore flag', async () => {
        const bodyWithForce = {
          ...validWebhookRequest,
          force_rescore: true,
        };

        const request = createMockRequest(bodyWithForce);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
      });

      it('should accept callback_url field', async () => {
        const bodyWithCallback = {
          ...validWebhookRequest,
          callback_url: 'https://example.com/callback',
        };

        const request = createMockRequest(bodyWithCallback);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
      });
    });

    describe('Lead Scoring', () => {
      it('should return scoring result for valid lead', async () => {
        const request = createMockRequest(validWebhookRequest);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            lead_id: validWebhookRequest.lead_id,
            score: expect.any(Number),
            tier: expect.any(String),
            recommended_angle: expect.any(String),
          },
        });
      });

      it('should include scoring breakdown in response', async () => {
        const request = createMockRequest(validWebhookRequest);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
        if (response.body.success && 'data' in response.body) {
          expect(response.body.data.scoring_breakdown).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                rule_id: expect.any(String),
                attribute: expect.any(String),
                score: expect.any(Number),
              }),
            ])
          );
        }
      });

      it('should include processing time in response', async () => {
        const request = createMockRequest(validWebhookRequest);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
        if (response.body.success && 'data' in response.body) {
          // Processing time can be 0ms for fast operations
          expect(response.body.data.processing_time_ms).toBeGreaterThanOrEqual(0);
          expect(typeof response.body.data.processing_time_ms).toBe('number');
        }
      });
    });

    describe('Enrichment Check', () => {
      it('should skip lead that needs enrichment', async () => {
        // Lead has required fields but missing >3 important optional fields:
        // company_size, industry, title, funding_stage, tech_stack
        const leadNeedingEnrichment = {
          lead_id: 'lead_needs_enrich_001',
          email: 'test@example.com',
          company: 'Unknown',
          source: 'website',
          // Missing all 5 important optional fields: company_size, industry, title, funding_stage, tech_stack
        };

        const request = createMockRequest(leadNeedingEnrichment);

        const response = await handler.handle(request);

        expect(response.status).toBe(HTTP_STATUS.OK);
        expect(response.body).toMatchObject({
          success: true,
          skipped: true,
          reason: 'NEEDS_ENRICHMENT',
        });
      });
    });

    describe('Agent Access', () => {
      it('should provide access to underlying agent', () => {
        const agent = handler.getAgent();

        expect(agent).toBeDefined();
        expect(typeof agent.scoreLead).toBe('function');
      });
    });
  });

  describe('createBunHandler', () => {
    let bunHandler: (request: Request) => Promise<Response>;

    beforeEach(() => {
      bunHandler = createBunHandler(createConfig());
    });

    it('should return 405 for non-POST requests', async () => {
      const request = new Request('http://localhost/webhook', {
        method: 'GET',
      });

      const response = await bunHandler(request);

      expect(response.status).toBe(405);

      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Only POST requests are accepted',
        },
      });
    });

    it('should handle valid POST request', async () => {
      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SECRET_HEADER]: TEST_SECRET,
        },
        body: JSON.stringify(validWebhookRequest),
      });

      const response = await bunHandler(request);

      expect(response.status).toBe(HTTP_STATUS.OK);

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SECRET_HEADER]: TEST_SECRET,
        },
        body: 'not valid json',
      });

      const response = await bunHandler(request);

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid JSON in request body',
        },
      });
    });

    it('should set Content-Type header in response', async () => {
      const request = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SECRET_HEADER]: TEST_SECRET,
        },
        body: JSON.stringify(validWebhookRequest),
      });

      const response = await bunHandler(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Error Handling', () => {
    describe('TimeoutError', () => {
      it('should be an instance of Error', () => {
        const error = new TimeoutError('Request timed out');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TimeoutError');
        expect(error.message).toBe('Request timed out');
      });
    });

    describe('BrainNotFoundError', () => {
      it('should be an instance of Error', () => {
        const error = new BrainNotFoundError('fintech');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('BrainNotFoundError');
        expect(error.message).toBe('No brain found for vertical: fintech');
      });
    });
  });
});

describe('Webhook API Utilities', () => {
  describe('validateWebhookAuth', () => {
    it('should validate with Record<string, string> headers', () => {
      const headers = {
        [WEBHOOK_SECRET_HEADER]: 'my-secret',
      };

      const result = validateWebhookAuth(headers, 'my-secret');

      expect(result).toEqual({ valid: true });
    });

    it('should validate with Headers object', () => {
      const headers = new Headers();
      headers.set(WEBHOOK_SECRET_HEADER, 'my-secret');

      const result = validateWebhookAuth(headers, 'my-secret');

      expect(result).toEqual({ valid: true });
    });

    it('should reject missing header', () => {
      const headers = {};

      const result = validateWebhookAuth(headers, 'my-secret');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should reject wrong secret', () => {
      const headers = {
        [WEBHOOK_SECRET_HEADER]: 'wrong-secret',
      };

      const result = validateWebhookAuth(headers, 'my-secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook secret');
    });
  });

  describe('validateWebhookRequest', () => {
    it('should validate complete request', () => {
      const result = validateWebhookRequest(validWebhookRequest);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject null body', () => {
      const result = validateWebhookRequest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject empty object', () => {
      const result = validateWebhookRequest({});

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should provide field-level error messages', () => {
      const result = validateWebhookRequest({
        lead_id: 123, // wrong type
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('lead_id')
      );
    });
  });

  describe('buildSuccessResponse', () => {
    it('should build success response', () => {
      const result = {
        lead_id: 'lead_001',
        score: 85,
        tier: 'hot' as const,
        scoring_breakdown: [],
        recommended_angle: 'pain_point' as const,
        personalization_hints: [],
        vertical_detected: 'general',
        brain_used: 'brain_general_v1',
        processing_time_ms: 100,
        rules_evaluated: 5,
        timestamp: new Date().toISOString(),
      };

      const response = buildSuccessResponse(result as any);

      expect(response).toEqual({
        success: true,
        data: result,
      });
    });
  });

  describe('buildErrorResponse', () => {
    it('should build error response without details', () => {
      const response = buildErrorResponse('AUTH_FAILED', 'Bad auth');

      expect(response).toEqual({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Bad auth',
        },
      });
    });

    it('should build error response with details', () => {
      const response = buildErrorResponse('INVALID_INPUT', 'Bad input', {
        field: 'email',
      });

      expect(response).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Bad input',
          details: { field: 'email' },
        },
      });
    });
  });

  describe('buildSkippedResponse', () => {
    it('should build skipped response for already scored', () => {
      const response = buildSkippedResponse(
        'ALREADY_SCORED',
        75,
        '2024-01-15T10:00:00Z'
      );

      expect(response).toEqual({
        success: true,
        skipped: true,
        reason: 'ALREADY_SCORED',
        existing_score: 75,
        scored_at: '2024-01-15T10:00:00Z',
      });
    });

    it('should build skipped response for needs enrichment', () => {
      const response = buildSkippedResponse('NEEDS_ENRICHMENT');

      expect(response).toEqual({
        success: true,
        skipped: true,
        reason: 'NEEDS_ENRICHMENT',
      });
    });
  });
});

describe('HTTP Status Constants', () => {
  it('should have correct status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    expect(HTTP_STATUS.TIMEOUT).toBe(504);
  });
});
