/**
 * Reply Handler Agent - Contracts
 *
 * Public contract exports for the reply handler agent.
 *
 * @module reply-handler/contracts
 */

// Reply Input contracts
export {
  // Schemas
  ThreadMessageSchema,
  ReplySourceSchema,
  ReplyInputSchema,
  LeadContextSchema,
  InstantlyWebhookPayloadSchema,
  // Types
  type ReplyId,
  type ThreadId,
  type LeadId,
  type BrainId,
  type ThreadMessage,
  type ReplySource,
  type ReplyInput,
  type LeadContext,
  type InstantlyWebhookPayload,
  // Helpers
  webhookToReplyInput,
  parseReplyInput,
  safeParseReplyInput,
} from './reply-input';

// Handler Result contracts
export {
  // Schemas
  IntentSchema,
  ComplexitySchema,
  UrgencySchema,
  ClassificationSchema,
  KBMatchSchema,
  RoutingFactorSchema,
  TierRoutingSchema,
  ActionTypeSchema,
  ActionResultSchema,
  CRMUpdatesSchema,
  InsightCategorySchema,
  ExtractedInsightSchema,
  ReplyHandlerResultSchema,
  // Types
  type Intent,
  type Complexity,
  type Urgency,
  type Classification,
  type KBMatch,
  type RoutingFactor,
  type TierRouting,
  type ActionType,
  type ActionResult,
  type CRMUpdates,
  type InsightCategory,
  type ExtractedInsight,
  type ReplyHandlerResult,
  // Helpers
  createAutoRespondResult,
  createDraftResult,
  createEscalationResult,
  parseReplyHandlerResult,
} from './handler-result';

// Webhook API contracts
export {
  // Endpoint definitions
  ReplyWebhookEndpoint,
  SlackActionEndpoint,
  HealthCheckEndpoint,
  DraftStatusEndpoint,
  // Schemas
  SlackActionPayloadSchema,
  SlackModalSubmissionSchema,
  // Types
  type SlackActionPayload,
  type SlackModalSubmission,
  type WebhookError,
  type N8nReplyHandlerWorkflow,
  // Security helpers
  verifyWebhookSecret,
  verifySlackSignature,
  // Error helpers
  createValidationError,
  createUnauthorizedError,
  createProcessingError,
  // Constants
  HTTP_STATUS,
} from './webhook-api';

// Structured output tool contracts - Classification
export {
  // Schemas
  ClassificationResultSchema,
  // Types
  type ClassificationResult,
  type ClassificationToolInput,
  // Tool
  CLASSIFICATION_TOOL,
} from './classification-tool';

// Structured output tool contracts - Response
export {
  // Schemas
  PersonalizedResponseSchema,
  ResponseToneSchema,
  // Types
  type PersonalizedResponse,
  type ResponseTone,
  type ResponseToolInput,
  // Tool
  RESPONSE_TOOL,
} from './response-tool';

// Structured output tool contracts - Insight
export {
  // Schemas
  ExtractedInsightItemSchema,
  InsightExtractionSchema,
  ImportanceLevelSchema,
  OverallQualitySchema,
  // Types
  type ExtractedInsightItem,
  type InsightExtraction,
  type ImportanceLevel,
  type OverallQuality,
  type InsightToolInput,
  // Tool
  INSIGHT_TOOL,
} from './insight-tool';
