/**
 * MCP REST API client service
 * Communicates with the MCP REST API server for KB operations
 */

const MCP_REST_API_URL = process.env.MCP_REST_API_URL || 'http://localhost:8100';

interface MCPError {
  error: string;
  details?: unknown;
}

interface MCPToolResponse<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

interface MCPToolCallParams {
  tool: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP REST API client
 * Provides typed methods for interacting with the MCP server
 */
export class MCPClient {
  private baseUrl: string;

  constructor(baseUrl: string = MCP_REST_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Call an MCP tool
   */
  async callTool<T = unknown>(params: MCPToolCallParams): Promise<MCPToolResponse<T>> {
    try {
      // Call the REST API endpoint directly: POST /tools/{tool_name}
      const response = await fetch(`${this.baseUrl}/tools/${params.tool}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.arguments),
      });

      // Parse response - REST API returns {success, result} or {success, error}
      const data = (await response.json()) as MCPToolResponse<T>;
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown MCP client error',
      };
    }
  }

  /**
   * Check if MCP server is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Qdrant KB Tools
  // ============================================================================

  /**
   * List all brains
   */
  async listBrains(status?: 'draft' | 'active' | 'archived') {
    // list_brains returns an array directly, not {brains: [...]}
    return this.callTool<unknown[]>({
      tool: 'list_brains',
      arguments: status ? { status } : {},
    });
  }

  /**
   * Get a specific brain by ID
   */
  async getBrain(brainId: string) {
    return this.callTool({
      tool: 'get_brain',
      arguments: { brain_id: brainId },
    });
  }

  /**
   * Create a new brain
   */
  async createBrain(data: {
    name: string;
    vertical: string;
    description?: string;
    config?: Record<string, unknown>;
  }) {
    return this.callTool({
      tool: 'create_brain',
      arguments: data,
    });
  }

  /**
   * Update brain status
   */
  async updateBrainStatus(brainId: string, status: 'draft' | 'active' | 'archived') {
    return this.callTool({
      tool: 'update_brain_status',
      arguments: { brain_id: brainId, status },
    });
  }

  /**
   * List ICP rules for a brain
   */
  async listICPRules(brainId: string, category?: string) {
    return this.callTool<unknown[]>({
      tool: 'list_icp_rules',
      arguments: {
        brain_id: brainId,
        category,
        limit: 100,
      },
    });
  }

  /**
   * Search ICP rules (semantic search)
   */
  async searchICPRules(brainId: string, query?: string, limit?: number) {
    return this.callTool({
      tool: 'query_icp_rules',
      arguments: {
        brain_id: brainId,
        query: query || 'ICP scoring criteria',
        limit: limit || 50,
      },
    });
  }

  /**
   * Get ICP rule by ID
   */
  async getICPRule(brainId: string, ruleId: string) {
    return this.callTool({
      tool: 'qdrant_get_icp_rule',
      arguments: { brain_id: brainId, rule_id: ruleId },
    });
  }

  /**
   * Create ICP rule
   */
  async createICPRule(brainId: string, data: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_create_icp_rule',
      arguments: { brain_id: brainId, ...data },
    });
  }

  /**
   * Update ICP rule
   */
  async updateICPRule(brainId: string, ruleId: string, updates: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_update_icp_rule',
      arguments: { brain_id: brainId, rule_id: ruleId, ...updates },
    });
  }

  /**
   * Delete ICP rule
   */
  async deleteICPRule(brainId: string, ruleId: string) {
    return this.callTool({
      tool: 'qdrant_delete_icp_rule',
      arguments: { brain_id: brainId, rule_id: ruleId },
    });
  }

  /**
   * Delete all ICP rules for a brain
   */
  async deleteAllICPRules(brainId: string) {
    return this.callTool({
      tool: 'qdrant_delete_all_icp_rules',
      arguments: { brain_id: brainId },
    });
  }

  // ============================================================================
  // Response Template Tools
  // ============================================================================

  /**
   * List response templates for a brain
   */
  async listTemplates(brainId: string, replyType?: string) {
    return this.callTool<unknown[]>({
      tool: 'list_response_templates',
      arguments: {
        brain_id: brainId,
        reply_type: replyType,
        limit: 100,
      },
    });
  }

  /**
   * Search response templates (by reply type)
   */
  async searchTemplates(brainId: string, replyType?: string, _query?: string) {
    return this.callTool({
      tool: 'get_response_template',
      arguments: {
        brain_id: brainId,
        reply_type: replyType || 'positive_interest',
      },
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(brainId: string, templateId: string) {
    return this.callTool({
      tool: 'qdrant_get_template',
      arguments: { brain_id: brainId, template_id: templateId },
    });
  }

  /**
   * Create response template
   */
  async createTemplate(brainId: string, data: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_create_template',
      arguments: { brain_id: brainId, ...data },
    });
  }

  /**
   * Update response template
   */
  async updateTemplate(brainId: string, templateId: string, updates: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_update_template',
      arguments: { brain_id: brainId, template_id: templateId, ...updates },
    });
  }

  /**
   * Delete response template
   */
  async deleteTemplate(brainId: string, templateId: string) {
    return this.callTool({
      tool: 'qdrant_delete_template',
      arguments: { brain_id: brainId, template_id: templateId },
    });
  }

  // ============================================================================
  // Objection Handler Tools
  // ============================================================================

  /**
   * List objection handlers for a brain
   */
  async listHandlers(brainId: string, objectionType?: string) {
    return this.callTool<unknown[]>({
      tool: 'list_objection_handlers',
      arguments: {
        brain_id: brainId,
        objection_type: objectionType,
        limit: 100,
      },
    });
  }

  /**
   * Search objection handlers (semantic search)
   */
  async searchHandlers(brainId: string, objectionType?: string, query?: string) {
    // Note: find_objection_handler requires objection_text for semantic search
    // For listing, use list_objection_handlers instead
    return this.callTool({
      tool: 'list_objection_handlers',
      arguments: {
        brain_id: brainId,
        objection_type: objectionType,
        limit: 100,
      },
    });
  }

  /**
   * Get handler by ID
   */
  async getHandler(brainId: string, handlerId: string) {
    return this.callTool({
      tool: 'qdrant_get_handler',
      arguments: { brain_id: brainId, handler_id: handlerId },
    });
  }

  /**
   * Create objection handler
   */
  async createHandler(brainId: string, data: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_create_handler',
      arguments: { brain_id: brainId, ...data },
    });
  }

  /**
   * Update objection handler
   */
  async updateHandler(brainId: string, handlerId: string, updates: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_update_handler',
      arguments: { brain_id: brainId, handler_id: handlerId, ...updates },
    });
  }

  /**
   * Delete objection handler
   */
  async deleteHandler(brainId: string, handlerId: string) {
    return this.callTool({
      tool: 'qdrant_delete_handler',
      arguments: { brain_id: brainId, handler_id: handlerId },
    });
  }

  // ============================================================================
  // Market Research Tools
  // ============================================================================

  /**
   * List research documents for a brain
   */
  async listResearch(brainId: string, contentType?: string) {
    return this.callTool<unknown[]>({
      tool: 'list_market_research',
      arguments: {
        brain_id: brainId,
        content_type: contentType,
        limit: 100,
      },
    });
  }

  /**
   * Search market research (semantic search)
   */
  async searchResearch(brainId: string, contentType?: string, query?: string) {
    return this.callTool({
      tool: 'search_market_research',
      arguments: {
        brain_id: brainId,
        content_type: contentType,
        query: query || 'market research insights',
        limit: 20,
      },
    });
  }

  /**
   * Get research document by ID
   */
  async getResearch(brainId: string, docId: string) {
    return this.callTool({
      tool: 'qdrant_get_research',
      arguments: { brain_id: brainId, doc_id: docId },
    });
  }

  /**
   * Create research document
   */
  async createResearch(brainId: string, data: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_create_research',
      arguments: { brain_id: brainId, ...data },
    });
  }

  /**
   * Update research document
   */
  async updateResearch(brainId: string, docId: string, updates: Record<string, unknown>) {
    return this.callTool({
      tool: 'qdrant_update_research',
      arguments: { brain_id: brainId, doc_id: docId, ...updates },
    });
  }

  /**
   * Delete research document
   */
  async deleteResearch(brainId: string, docId: string) {
    return this.callTool({
      tool: 'qdrant_delete_research',
      arguments: { brain_id: brainId, doc_id: docId },
    });
  }
}

// Singleton instance
export const mcpClient = new MCPClient();
