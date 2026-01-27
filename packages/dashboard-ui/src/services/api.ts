/**
 * API client service for Dashboard UI
 * Handles all HTTP requests to the Dashboard API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DASHBOARD_SECRET = import.meta.env.VITE_DASHBOARD_SECRET || '';

interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

interface ApiSuccess<T> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

// ApiResponse type for future use in typed API responses
type _ApiResponse<T> = ApiSuccess<T> | ApiError;
export type { _ApiResponse as ApiResponse };

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Build headers for API requests
 */
function buildHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth header if secret is configured
  if (DASHBOARD_SECRET) {
    headers['X-Dashboard-Secret'] = DASHBOARD_SECRET;
  }

  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
}

/**
 * Make an API request
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers as Record<string, string>),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    // Dispatch auth error event for 401 responses (session expiry)
    if (response.status === 401) {
      window.dispatchEvent(
        new CustomEvent('api-auth-error', {
          detail: { status: 401, message: data.error || 'Authentication required' },
        })
      );
    }

    throw new ApiClientError(
      data.error || 'Request failed',
      data.code || 'UNKNOWN_ERROR',
      response.status,
      data.details
    );
  }

  return data as T;
}

/**
 * API client with typed methods
 */
export const api = {
  /**
   * GET request
   */
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// ============================================================================
// Typed API Endpoints
// ============================================================================

/**
 * Agent status endpoints
 */
export const agentsApi = {
  getAll: () => api.get<{ success: true; agents: unknown[]; timestamp: string }>('/agents'),
  getHealth: (name: string) =>
    api.get<{ success: true; agent: unknown }>(`/agents/${name}/health`),
};

/**
 * Activity endpoints
 */
export const activityApi = {
  getRecent: (params?: { limit?: number; offset?: number; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.type) searchParams.set('type', params.type);
    const query = searchParams.toString();
    return api.get<{ success: true; items: unknown[]; total: number; has_more: boolean }>(
      `/activity${query ? `?${query}` : ''}`
    );
  },
};

/**
 * Brains endpoints
 */
export const brainsApi = {
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api.get<{ success: true; brains: unknown[] }>(`/brains${query}`);
  },
  getById: (brainId: string) =>
    api.get<{ success: true; brain: unknown }>(`/brains/${brainId}`),
  create: (data: { name: string; vertical: string; description?: string }) =>
    api.post<{ success: true; brain: unknown }>('/brains', data),
  update: (brainId: string, data: { name?: string; description?: string }) =>
    api.put<{ success: true; brain: unknown }>(`/brains/${brainId}`, data),
  activate: (brainId: string) =>
    api.post<{ success: true; brain: unknown }>(`/brains/${brainId}/activate`),
  archive: (brainId: string) =>
    api.post<{ success: true; brain: unknown }>(`/brains/${brainId}/archive`),
  clone: (brainId: string, newName: string) =>
    api.post<{ success: true; brain: unknown }>(`/brains/${brainId}/clone`, { name: newName }),
};

/**
 * ICP Rules endpoints
 */
export const icpRulesApi = {
  getAll: (brainId: string) =>
    api.get<{ success: true; rules: unknown[] }>(`/brains/${brainId}/icp-rules`),
  getById: (brainId: string, ruleId: string) =>
    api.get<{ success: true; rule: unknown }>(`/brains/${brainId}/icp-rules/${ruleId}`),
  create: (brainId: string, data: unknown) =>
    api.post<{ success: true; rule: unknown }>(`/brains/${brainId}/icp-rules`, data),
  update: (brainId: string, ruleId: string, data: unknown) =>
    api.put<{ success: true; rule: unknown }>(`/brains/${brainId}/icp-rules/${ruleId}`, data),
  delete: (brainId: string, ruleId: string) =>
    api.delete<{ success: true }>(`/brains/${brainId}/icp-rules/${ruleId}`),
  bulkImport: (brainId: string, rules: unknown[]) =>
    api.post<{ success: true; imported: number }>(`/brains/${brainId}/icp-rules/import`, {
      rules,
    }),
};

/**
 * Templates endpoints
 */
export const templatesApi = {
  getAll: (brainId: string) =>
    api.get<{ success: true; templates: unknown[] }>(`/brains/${brainId}/templates`),
  getById: (brainId: string, templateId: string) =>
    api.get<{ success: true; template: unknown }>(
      `/brains/${brainId}/templates/${templateId}`
    ),
  create: (brainId: string, data: unknown) =>
    api.post<{ success: true; template: unknown }>(`/brains/${brainId}/templates`, data),
  update: (brainId: string, templateId: string, data: unknown) =>
    api.put<{ success: true; template: unknown }>(
      `/brains/${brainId}/templates/${templateId}`,
      data
    ),
  delete: (brainId: string, templateId: string) =>
    api.delete<{ success: true }>(`/brains/${brainId}/templates/${templateId}`),
  preview: (brainId: string, templateId: string, variables: Record<string, string>) =>
    api.post<{ success: true; preview: string }>(
      `/brains/${brainId}/templates/${templateId}/preview`,
      { variables }
    ),
};

/**
 * Handlers endpoints
 */
export const handlersApi = {
  getAll: (brainId: string) =>
    api.get<{ success: true; handlers: unknown[] }>(`/brains/${brainId}/handlers`),
  getById: (brainId: string, handlerId: string) =>
    api.get<{ success: true; handler: unknown }>(
      `/brains/${brainId}/handlers/${handlerId}`
    ),
  create: (brainId: string, data: unknown) =>
    api.post<{ success: true; handler: unknown }>(`/brains/${brainId}/handlers`, data),
  update: (brainId: string, handlerId: string, data: unknown) =>
    api.put<{ success: true; handler: unknown }>(
      `/brains/${brainId}/handlers/${handlerId}`,
      data
    ),
  delete: (brainId: string, handlerId: string) =>
    api.delete<{ success: true }>(`/brains/${brainId}/handlers/${handlerId}`),
  testMatch: (brainId: string, text: string) =>
    api.post<{ success: true; matches: unknown[] }>(`/brains/${brainId}/handlers/test-match`, {
      text,
    }),
};

/**
 * Research endpoints
 */
export const researchApi = {
  getAll: (brainId: string, tags?: string[]) => {
    const query = tags?.length ? `?tags=${tags.join(',')}` : '';
    return api.get<{ success: true; documents: unknown[] }>(
      `/brains/${brainId}/research${query}`
    );
  },
  getById: (brainId: string, docId: string) =>
    api.get<{ success: true; document: unknown }>(`/brains/${brainId}/research/${docId}`),
  create: (brainId: string, data: unknown) =>
    api.post<{ success: true; document: unknown }>(`/brains/${brainId}/research`, data),
  update: (brainId: string, docId: string, data: unknown) =>
    api.put<{ success: true; document: unknown }>(
      `/brains/${brainId}/research/${docId}`,
      data
    ),
  delete: (brainId: string, docId: string) =>
    api.delete<{ success: true }>(`/brains/${brainId}/research/${docId}`),
};

/**
 * Pending items endpoints
 */
export const pendingApi = {
  getAll: (params?: { type?: string; urgency?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.urgency) searchParams.set('urgency', params.urgency);
    const query = searchParams.toString();
    return api.get<{ success: true; items: unknown[]; total: number }>(
      `/pending${query ? `?${query}` : ''}`
    );
  },
  getById: (itemId: string) =>
    api.get<{ success: true; item: unknown }>(`/pending/${itemId}`),
  getCounts: () =>
    api.get<{
      success: true;
      total: number;
      by_urgency: Record<string, number>;
      by_type: Record<string, number>;
    }>('/pending/counts'),
  approve: (itemId: string, notes?: string) =>
    api.post<{ success: true; item_id: string; action: 'approved' }>(
      `/pending/${itemId}/approve`,
      { notes }
    ),
  reject: (itemId: string, reason: string) =>
    api.post<{ success: true; item_id: string; action: 'rejected' }>(
      `/pending/${itemId}/reject`,
      { reason }
    ),
};

/**
 * Metrics endpoints
 */
export const metricsApi = {
  get: (period: 'today' | '7d' | '30d' = 'today') =>
    api.get<{ success: true; metrics: unknown }>(`/metrics?period=${period}`),
};

/**
 * Manual actions endpoints
 */
export const actionsApi = {
  scoreLead: (email: string, companyName?: string, forceRescore?: boolean) =>
    api.post<{ success: true; message: string; request_id: string }>('/actions/score-lead', {
      email,
      company_name: companyName,
      force_rescore: forceRescore,
    }),
  generateBrief: (participantEmail: string, meetingId?: string) =>
    api.post<{ success: true; message: string; request_id: string }>(
      '/actions/generate-brief',
      {
        participant_email: participantEmail,
        meeting_id: meetingId,
      }
    ),
};

/**
 * System health endpoint (public, no auth required)
 */
export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    mcp_api: 'up' | 'down';
    qdrant: 'up' | 'down';
    redis: 'up' | 'down';
    agents: Record<string, 'up' | 'down'>;
  };
}

export const healthApi = {
  /**
   * Get system health status (no auth required)
   */
  get: async (): Promise<SystemHealthResponse> => {
    // Health endpoint is at root, not under /api
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  },
};
