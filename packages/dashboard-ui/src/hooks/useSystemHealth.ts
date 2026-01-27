/**
 * React Query hook for system health status
 * Monitors Qdrant, Redis, MCP API, and agent connectivity
 */
import { useQuery } from '@tanstack/react-query';
import { healthApi, SystemHealthResponse } from '@/services/api';

export type ServiceStatus = 'up' | 'down';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  qdrant: ServiceStatus;
  redis: ServiceStatus;
  mcpApi: ServiceStatus;
  timestamp: string;
}

/**
 * Query key factory for system health
 */
export const systemHealthKeys = {
  all: ['system-health'] as const,
  status: () => [...systemHealthKeys.all, 'status'] as const,
};

/**
 * Hook to monitor system health
 * Polls every 30 seconds to detect service outages
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: systemHealthKeys.status(),
    queryFn: async (): Promise<SystemHealth> => {
      try {
        const response: SystemHealthResponse = await healthApi.get();
        return {
          status: response.status,
          qdrant: response.services.qdrant,
          redis: response.services.redis,
          mcpApi: response.services.mcp_api,
          timestamp: response.timestamp,
        };
      } catch {
        // If health check fails, assume all services are down
        return {
          status: 'unhealthy',
          qdrant: 'down',
          redis: 'down',
          mcpApi: 'down',
          timestamp: new Date().toISOString(),
        };
      }
    },
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    staleTime: 15 * 1000,
    retry: 1, // Only retry once on failure
  });
}

/**
 * Hook specifically for Qdrant status (convenience)
 */
export function useQdrantStatus() {
  const { data, isLoading, isError } = useSystemHealth();

  return {
    status: data?.qdrant ?? 'down',
    isLoading,
    isError,
    isConnected: data?.qdrant === 'up',
  };
}

/**
 * Get display text for service status
 */
export function getServiceStatusText(status: ServiceStatus): string {
  return status === 'up' ? 'Connected' : 'Disconnected';
}

/**
 * Get color class for service status
 */
export function getServiceStatusColor(status: ServiceStatus): string {
  return status === 'up' ? 'text-success' : 'text-error';
}
