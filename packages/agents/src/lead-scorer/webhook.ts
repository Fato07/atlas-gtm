/**
 * Webhook Endpoint Handler
 *
 * Handles incoming webhook requests for lead scoring.
 * Validates authentication, parses requests, and routes to agent.
 *
 * @module lead-scorer/webhook
 */

import type { LeadInput } from './contracts/lead-input';
import type { ScoringResult } from './contracts/scoring-result';
import type {
  WebhookRequest,
  WebhookResponse,
  WebhookSuccessResponse,
  WebhookErrorResponse,
  WebhookSkippedResponse,
} from './contracts/webhook-api';
import {
  WEBHOOK_SECRET_HEADER,
  HTTP_STATUS,
  validateWebhookAuth,
  validateWebhookRequest,
  buildSuccessResponse,
  buildErrorResponse,
  buildSkippedResponse,
  errorCodeToHttpStatus,
} from './contracts/webhook-api';
import { LeadScorerAgent } from './agent';
import { logger } from './logger';
import { needsEnrichment } from './contracts/lead-input';

// ===========================================
// Types
// ===========================================

/**
 * Webhook handler configuration
 */
export interface WebhookHandlerConfig {
  /** Expected webhook secret for authentication */
  webhookSecret: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum retries for transient failures */
  maxRetries?: number;
  /** Anthropic API key for LLM scoring */
  anthropicApiKey?: string;
  /** Use heuristics-only for angle recommendation */
  useHeuristicsForAngle?: boolean;
}

/**
 * Handler response with HTTP status
 */
export interface HandlerResponse {
  status: number;
  body: WebhookResponse;
  headers?: Record<string, string>;
}

/**
 * Incoming request interface (framework-agnostic)
 */
export interface IncomingRequest {
  headers: Headers | Record<string, string>;
  body: unknown;
}

/**
 * Lead existence check result
 */
export interface LeadExistenceCheck {
  exists: boolean;
  existingScore?: number;
  scoredAt?: string;
  dataChanged?: boolean;
}

// ===========================================
// Webhook Handler
// ===========================================

/**
 * Webhook Handler Class
 *
 * Processes incoming webhook requests for lead scoring.
 */
export class WebhookHandler {
  private config: Required<WebhookHandlerConfig>;
  private agent: LeadScorerAgent;

  constructor(config: WebhookHandlerConfig) {
    this.config = {
      webhookSecret: config.webhookSecret,
      timeoutMs: config.timeoutMs ?? 10000,
      maxRetries: config.maxRetries ?? 3,
      anthropicApiKey: config.anthropicApiKey ?? '',
      useHeuristicsForAngle: config.useHeuristicsForAngle ?? true,
    };

    this.agent = new LeadScorerAgent({
      anthropicApiKey: this.config.anthropicApiKey,
      useHeuristicsForAngle: this.config.useHeuristicsForAngle,
    });
  }

  /**
   * Handle incoming webhook request
   *
   * @param request - Incoming request with headers and body
   * @returns Response with HTTP status and body
   */
  async handle(request: IncomingRequest): Promise<HandlerResponse> {
    const startTime = Date.now();

    try {
      // 1. Validate authentication
      const authResult = validateWebhookAuth(
        request.headers,
        this.config.webhookSecret
      );

      if (!authResult.valid) {
        logger.webhookReceived({
          auth_valid: false,
          status_code: HTTP_STATUS.UNAUTHORIZED,
        });

        return {
          status: HTTP_STATUS.UNAUTHORIZED,
          body: buildErrorResponse(
            'AUTH_FAILED',
            authResult.error || 'Authentication failed'
          ),
        };
      }

      // 2. Validate request body
      const validationResult = validateWebhookRequest(request.body);

      if (!validationResult.valid) {
        logger.webhookReceived({
          auth_valid: true,
          status_code: HTTP_STATUS.BAD_REQUEST,
        });

        return {
          status: HTTP_STATUS.BAD_REQUEST,
          body: buildErrorResponse(
            'INVALID_INPUT',
            'Request validation failed',
            { errors: validationResult.errors }
          ),
        };
      }

      const webhookRequest = validationResult.data!;

      // 3. Check if lead needs enrichment
      if (needsEnrichment(webhookRequest)) {
        logger.webhookReceived({
          auth_valid: true,
          lead_id: webhookRequest.lead_id,
          status_code: HTTP_STATUS.OK,
        });

        return {
          status: HTTP_STATUS.OK,
          body: buildSkippedResponse('NEEDS_ENRICHMENT'),
        };
      }

      // 4. Check for duplicate scoring (per FR-014)
      const existenceCheck = await this.checkLeadExistence(webhookRequest);

      if (existenceCheck.exists && !webhookRequest.force_rescore && !existenceCheck.dataChanged) {
        logger.webhookReceived({
          auth_valid: true,
          lead_id: webhookRequest.lead_id,
          status_code: HTTP_STATUS.OK,
        });

        return {
          status: HTTP_STATUS.OK,
          body: buildSkippedResponse(
            'ALREADY_SCORED',
            existenceCheck.existingScore,
            existenceCheck.scoredAt
          ),
        };
      }

      // 5. Score the lead with timeout
      const result = await this.scoreWithTimeout(webhookRequest);

      const processingTime = Date.now() - startTime;

      logger.webhookReceived({
        auth_valid: true,
        lead_id: webhookRequest.lead_id,
        status_code: HTTP_STATUS.OK,
        processing_time_ms: processingTime,
      });

      return {
        status: HTTP_STATUS.OK,
        body: buildSuccessResponse(result),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Score lead with timeout wrapper
   */
  private async scoreWithTimeout(request: WebhookRequest): Promise<ScoringResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      // Create promise that rejects on abort
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new TimeoutError('Request timed out'));
        });
      });

      // Race scoring against timeout
      const result = await Promise.race([
        this.agent.scoreLead(request),
        abortPromise,
      ]);

      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if lead has already been scored
   * Per FR-014: Skip if already scored unless force_rescore or data changed
   */
  async checkLeadExistence(request: WebhookRequest): Promise<LeadExistenceCheck> {
    // TODO: Implement actual check against scoring history
    // For now, return false (no existing score)
    // This would query Airtable or a cache for existing scores
    return {
      exists: false,
    };
  }

  /**
   * Handle errors and convert to response
   */
  private handleError(error: unknown): HandlerResponse {
    if (error instanceof TimeoutError) {
      return {
        status: HTTP_STATUS.TIMEOUT,
        body: buildErrorResponse('TIMEOUT', 'Request timed out'),
      };
    }

    if (error instanceof BrainNotFoundError) {
      return {
        status: HTTP_STATUS.INTERNAL_ERROR,
        body: buildErrorResponse('BRAIN_NOT_FOUND', error.message),
      };
    }

    const message = error instanceof Error ? error.message : String(error);

    logger.scoringFailed({
      lead_id: 'unknown',
      error_code: 'SCORING_FAILED',
      error_message: message,
    });

    return {
      status: HTTP_STATUS.INTERNAL_ERROR,
      body: buildErrorResponse('SCORING_FAILED', message),
    };
  }

  /**
   * Get the underlying agent instance
   */
  getAgent(): LeadScorerAgent {
    return this.agent;
  }
}

// ===========================================
// Custom Errors
// ===========================================

/**
 * Error thrown when request times out
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when brain is not found
 */
export class BrainNotFoundError extends Error {
  constructor(vertical: string) {
    super(`No brain found for vertical: ${vertical}`);
    this.name = 'BrainNotFoundError';
  }
}

// ===========================================
// Factory Functions
// ===========================================

/**
 * Create a webhook handler
 */
export function createWebhookHandler(
  config: WebhookHandlerConfig
): WebhookHandler {
  return new WebhookHandler(config);
}

/**
 * Create a Bun HTTP handler for the webhook
 *
 * @example
 * ```typescript
 * const handler = createBunHandler({
 *   webhookSecret: process.env.WEBHOOK_SECRET!,
 * });
 *
 * Bun.serve({
 *   port: 3000,
 *   fetch: handler,
 * });
 * ```
 */
export function createBunHandler(
  config: WebhookHandlerConfig
): (request: Request) => Promise<Response> {
  const handler = createWebhookHandler(config);

  return async (request: Request): Promise<Response> => {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify(
          buildErrorResponse('INVALID_INPUT', 'Only POST requests are accepted')
        ),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      const body = await request.json();

      const result = await handler.handle({
        headers: request.headers,
        body,
      });

      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          ...result.headers,
        },
      });
    } catch (error) {
      // JSON parse error
      return new Response(
        JSON.stringify(
          buildErrorResponse('INVALID_INPUT', 'Invalid JSON in request body')
        ),
        {
          status: HTTP_STATUS.BAD_REQUEST,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

// ===========================================
// Re-exports for convenience
// ===========================================

export {
  WEBHOOK_SECRET_HEADER,
  HTTP_STATUS,
  validateWebhookAuth,
  validateWebhookRequest,
  buildSuccessResponse,
  buildErrorResponse,
  buildSkippedResponse,
  errorCodeToHttpStatus,
};
