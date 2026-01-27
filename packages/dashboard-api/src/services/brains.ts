/**
 * Brains service
 * Manages brain CRUD operations via MCP REST API
 *
 * Architecture: Schema-First with Validated BFF Pattern
 * - McpBrainResponseSchema defines what MCP returns (source contract)
 * - BrainSchema defines what dashboard expects (target contract)
 * - transformMcpBrain validates input and output with explicit error handling
 */
import { z } from 'zod';
import {
  Brain,
  BrainSchema,
  BrainConfig,
  BrainStats,
  CreateBrainRequest,
  UpdateBrainRequest,
  ListBrainsParams,
} from '../contracts';
import { mcpClient } from './mcp-client';

// ============================================================================
// MCP Response Schema (Source Contract)
// ============================================================================

/**
 * Schema for what MCP's list_brains/get_brain actually returns.
 * This is the explicit contract for the MCP→Dashboard boundary.
 *
 * If MCP changes format, this parse will fail with a clear error,
 * rather than silently returning undefined fields.
 */
const McpBrainResponseSchema = z.object({
  brain_id: z.string(),
  name: z.string(),
  vertical: z.string(),
  version: z.string().optional(),
  status: z.string().default('draft'),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  stats: z.record(z.number()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

type McpBrainResponse = z.infer<typeof McpBrainResponseSchema>;

// ============================================================================
// Default Values
// ============================================================================

const defaultStats: BrainStats = {
  icp_rules_count: 0,
  templates_count: 0,
  handlers_count: 0,
  research_docs_count: 0,
  insights_count: 0,
};

function defaultConfig(vertical: string): BrainConfig {
  return {
    vertical,
    target_roles: [],
    target_company_sizes: [],
    geo_focus: [],
  };
}

// ============================================================================
// Transformation with Validation
// ============================================================================

/**
 * Transform MCP brain response to match Brain type expected by UI.
 *
 * This is a validated BFF (Backend-for-Frontend) transformation:
 * 1. Validate MCP response structure (fail loudly if invalid)
 * 2. Transform to dashboard contract (explicit, documented)
 * 3. Validate output matches Brain contract
 *
 * @throws {z.ZodError} If MCP response doesn't match expected schema
 */
function transformMcpBrain(raw: unknown): Brain {
  // 1. Validate MCP response structure
  const mcpBrain = McpBrainResponseSchema.parse(raw);

  // 2. Transform to dashboard contract (explicit, documented)
  const mcpConfig = mcpBrain.config || {};
  const mcpStats = mcpBrain.stats || {};

  const now = new Date().toISOString();

  const brain: Brain = {
    brain_id: mcpBrain.brain_id,
    name: mcpBrain.name,
    vertical: mcpBrain.vertical,
    status: parseStatus(mcpBrain.status),
    config: {
      vertical: mcpBrain.vertical,
      target_roles: Array.isArray(mcpConfig.target_roles)
        ? (mcpConfig.target_roles as string[])
        : [],
      target_company_sizes: Array.isArray(mcpConfig.target_company_sizes)
        ? (mcpConfig.target_company_sizes as string[])
        : [],
      geo_focus: Array.isArray(mcpConfig.geo_focus)
        ? (mcpConfig.geo_focus as string[])
        : [],
      // Preserve extra config fields from MCP
      ...(typeof mcpConfig === 'object' ? mcpConfig : {}),
    },
    stats: {
      icp_rules_count: Number(mcpStats.icp_rules_count) || 0,
      templates_count: Number(mcpStats.templates_count) || 0,
      handlers_count: Number(mcpStats.handlers_count) || 0,
      research_docs_count: Number(mcpStats.research_docs_count) || 0,
      insights_count: Number(mcpStats.insights_count) || 0,
    },
    created_at: mcpBrain.created_at || now,
    updated_at: mcpBrain.updated_at || now,
  };

  // 3. Validate output matches Brain contract
  return BrainSchema.parse(brain);
}

/**
 * Safely parse status string to Brain status enum.
 * Falls back to 'draft' if unknown status.
 */
function parseStatus(status: string): Brain['status'] {
  const validStatuses: Brain['status'][] = ['draft', 'active', 'archived'];
  return validStatuses.includes(status as Brain['status'])
    ? (status as Brain['status'])
    : 'draft';
}

/**
 * Transform multiple brains with validation.
 * Logs and skips invalid brains rather than failing entirely.
 */
function transformMcpBrains(rawBrains: unknown[]): Brain[] {
  const brains: Brain[] = [];

  for (let i = 0; i < rawBrains.length; i++) {
    try {
      const brain = transformMcpBrain(rawBrains[i]);
      brains.push(brain);
    } catch (error) {
      console.error(`[brains] Failed to transform brain at index ${i}:`, error);
      // Log the raw data for debugging
      console.error('[brains] Raw brain data:', JSON.stringify(rawBrains[i], null, 2));
      // Skip invalid brain rather than failing entire operation
    }
  }

  return brains;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List all brains with optional filtering
 */
export async function listBrains(params?: ListBrainsParams): Promise<Brain[]> {
  try {
    // Fetch from MCP/Qdrant
    const response = await mcpClient.listBrains(params?.status);
    if (response.success && Array.isArray(response.result)) {
      const rawBrains = response.result;
      console.log('[brains] MCP returned', rawBrains.length, 'brains from Qdrant');

      // Transform with validation
      let brains = transformMcpBrains(rawBrains);

      // Apply filters if needed
      if (params?.vertical) {
        brains = brains.filter(b => b.vertical === params.vertical);
      }

      return brains;
    }
    console.error('[brains] MCP returned unsuccessful response:', response);
    return [];
  } catch (error) {
    console.error('[brains] MCP error:', error);
    return [];
  }
}

/**
 * Get a single brain by ID
 */
export async function getBrain(brainId: string): Promise<Brain | null> {
  try {
    const response = await mcpClient.getBrain(brainId);
    if (response.success && response.result) {
      console.log('[brains] MCP returned brain:', brainId);
      return transformMcpBrain(response.result);
    }
    console.error('[brains] Brain not found:', brainId);
    return null;
  } catch (error) {
    // Check if it's a Zod validation error (schema mismatch)
    if (error instanceof z.ZodError) {
      console.error('[brains] MCP response validation failed:', error.errors);
      throw new Error(`Invalid brain data from MCP: ${error.message}`);
    }
    console.error('[brains] MCP error getting brain:', error);
    return null;
  }
}

/**
 * Create a new brain
 */
export async function createBrain(data: CreateBrainRequest): Promise<Brain> {
  const config = {
    ...defaultConfig(data.vertical),
    ...data.config,
  };

  try {
    const response = await mcpClient.createBrain({
      name: data.name,
      vertical: data.vertical,
      config,
    });
    if (response.success && response.result) {
      console.log('[brains] Created brain via MCP:', data.name);
      return transformMcpBrain(response.result);
    }
    throw new Error('MCP returned unsuccessful response');
  } catch (error) {
    // Check if it's a Zod validation error
    if (error instanceof z.ZodError) {
      console.error('[brains] Created brain response validation failed:', error.errors);
      throw new Error(`Invalid brain data from MCP after creation: ${error.message}`);
    }
    console.error('[brains] Failed to create brain:', error);
    throw new Error(`Failed to create brain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a brain
 * TODO: Implement MCP update method
 */
export async function updateBrain(
  brainId: string,
  _data: UpdateBrainRequest
): Promise<Brain | null> {
  // MCP doesn't have an update method yet - need to implement
  console.error('[brains] updateBrain not implemented in MCP yet:', brainId);
  throw new Error('Brain update not implemented yet. Please use activate/archive for status changes.');
}

/**
 * Activate a brain (archives currently active brain of same vertical)
 */
export async function activateBrain(brainId: string): Promise<{
  brain: Brain;
  archived_brain_id: string | null;
}> {
  try {
    const response = await mcpClient.updateBrainStatus(brainId, 'active');
    if (response.success && response.result) {
      console.log('[brains] Activated brain via MCP:', brainId);
      return {
        brain: transformMcpBrain(response.result),
        archived_brain_id: null, // MCP handles this internally
      };
    }
    throw new Error('MCP returned unsuccessful response');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[brains] Activated brain response validation failed:', error.errors);
      throw new Error(`Invalid brain data from MCP after activation: ${error.message}`);
    }
    console.error('[brains] Failed to activate brain:', error);
    throw new Error(`Failed to activate brain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Archive a brain
 */
export async function archiveBrain(brainId: string): Promise<Brain | null> {
  try {
    const response = await mcpClient.updateBrainStatus(brainId, 'archived');
    if (response.success && response.result) {
      console.log('[brains] Archived brain via MCP:', brainId);
      return transformMcpBrain(response.result);
    }
    throw new Error('MCP returned unsuccessful response');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[brains] Archived brain response validation failed:', error.errors);
      throw new Error(`Invalid brain data from MCP after archiving: ${error.message}`);
    }
    console.error('[brains] Failed to archive brain:', error);
    throw new Error(`Failed to archive brain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clone a brain
 * Implemented using getBrain + createBrain since MCP doesn't have a dedicated clone method
 */
export async function cloneBrain(
  sourceBrainId: string,
  newName: string
): Promise<Brain> {
  // Fetch the source brain
  const source = await getBrain(sourceBrainId);
  if (!source) {
    throw new Error(`Source brain not found: ${sourceBrainId}`);
  }

  // Create a new brain with the same config
  const cloned = await createBrain({
    name: newName,
    vertical: source.vertical,
    config: source.config,
  });

  console.log('[brains] Cloned brain:', sourceBrainId, '->', cloned.brain_id);
  return cloned;
}

/**
 * Check if a brain name is unique
 */
export async function isBrainNameUnique(name: string, excludeBrainId?: string): Promise<boolean> {
  const brains = await listBrains();
  return !brains.some(
    b => b.name.toLowerCase() === name.toLowerCase() && b.brain_id !== excludeBrainId
  );
}
