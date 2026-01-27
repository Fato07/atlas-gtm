/**
 * Dashboard API Redis Client
 *
 * Connects to the same Upstash Redis instance as Learning Loop agent
 * to read/write pending validation items.
 *
 * Key patterns must match Learning Loop's redis-client.ts exactly:
 * - learning-loop:validation:{id} - validation item storage
 * - learning-loop:pending:{brainId} - set of pending IDs per brain
 *
 * @module services/redis-client
 */

import { Redis } from '@upstash/redis';

// =============================================================================
// Configuration
// =============================================================================

const REDIS_CONFIG = {
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
};

const KEY_PREFIX = 'learning-loop';

// =============================================================================
// Redis Client Singleton
// =============================================================================

let redisClient: Redis | null = null;
let isInitialized = false;
let initializationError: string | null = null;

/**
 * Initialize the Redis client.
 * Call this during server startup.
 */
export function initRedis(): { success: boolean; error?: string } {
  if (isInitialized) {
    return redisClient ? { success: true } : { success: false, error: initializationError ?? 'Unknown error' };
  }

  isInitialized = true;

  if (!REDIS_CONFIG.url || !REDIS_CONFIG.token) {
    initializationError = 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN';
    console.warn('[redis-client] Redis not configured:', initializationError);
    return { success: false, error: initializationError };
  }

  try {
    redisClient = new Redis({
      url: REDIS_CONFIG.url,
      token: REDIS_CONFIG.token,
    });
    console.log('[redis-client] Redis client initialized successfully');
    return { success: true };
  } catch (error) {
    initializationError = error instanceof Error ? error.message : 'Failed to create Redis client';
    console.error('[redis-client] Failed to initialize Redis:', initializationError);
    return { success: false, error: initializationError };
  }
}

/**
 * Get the Redis client instance.
 * Returns null if not initialized or configuration is missing.
 */
export function getRedisClient(): Redis | null {
  if (!isInitialized) {
    initRedis();
  }
  return redisClient;
}

/**
 * Check if Redis is available.
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null;
}

// =============================================================================
// Key Builders (must match Learning Loop's patterns exactly)
// =============================================================================

/**
 * Build a validation item key.
 * Pattern: learning-loop:validation:{validationId}
 */
export function validationKey(validationId: string): string {
  return `${KEY_PREFIX}:validation:${validationId}`;
}

/**
 * Build a pending validations set key.
 * Pattern: learning-loop:pending:{brainId}
 */
export function pendingValidationsKey(brainId: string): string {
  return `${KEY_PREFIX}:pending:${brainId}`;
}

/**
 * Build a template performance key.
 * Pattern: learning-loop:template:{brainId}:{templateId}
 */
export function templateKey(brainId: string, templateId: string): string {
  return `${KEY_PREFIX}:template:${brainId}:${templateId}`;
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * Ping Redis to verify connection.
 */
export async function pingRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// =============================================================================
// Validation Item Operations
// =============================================================================

/**
 * Get a validation item by ID.
 */
export async function getValidationItem<T>(validationId: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = validationKey(validationId);
    const result = await client.get<T>(key);
    return result;
  } catch (error) {
    console.error('[redis-client] Error getting validation item:', error);
    return null;
  }
}

/**
 * Set a validation item.
 */
export async function setValidationItem<T>(validationId: string, item: T, ttlSeconds?: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const key = validationKey(validationId);
    if (ttlSeconds) {
      await client.set(key, item, { ex: ttlSeconds });
    } else {
      await client.set(key, item);
    }
    return true;
  } catch (error) {
    console.error('[redis-client] Error setting validation item:', error);
    return false;
  }
}

/**
 * Delete a validation item and remove from pending set.
 */
export async function deleteValidationItem(validationId: string, brainId: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const itemKey = validationKey(validationId);
    const pendingKey = pendingValidationsKey(brainId);

    // Use pipeline for atomic operations
    const pipeline = client.pipeline();
    pipeline.del(itemKey);
    pipeline.srem(pendingKey, validationId);
    await pipeline.exec();

    return true;
  } catch (error) {
    console.error('[redis-client] Error deleting validation item:', error);
    return false;
  }
}

/**
 * Get all pending validation IDs for a brain.
 */
export async function getPendingValidationIds(brainId: string): Promise<string[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const key = pendingValidationsKey(brainId);
    const result = await client.smembers(key);
    return result as string[];
  } catch (error) {
    console.error('[redis-client] Error getting pending validation IDs:', error);
    return [];
  }
}

/**
 * Get count of pending validations for a brain.
 */
export async function getPendingValidationCount(brainId: string): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    const key = pendingValidationsKey(brainId);
    return await client.scard(key);
  } catch (error) {
    console.error('[redis-client] Error getting pending validation count:', error);
    return 0;
  }
}

/**
 * Get all pending validations for a brain.
 */
export async function getPendingValidations<T>(brainId: string): Promise<T[]> {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const ids = await getPendingValidationIds(brainId);
    if (ids.length === 0) return [];

    const keys = ids.map((id) => validationKey(id));
    const results = await client.mget<(T | null)[]>(...keys);

    return results.filter((r): r is T => r !== null);
  } catch (error) {
    console.error('[redis-client] Error getting pending validations:', error);
    return [];
  }
}
