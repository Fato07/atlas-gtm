/**
 * useAuth hook
 * Handles authentication state and session expiry detection
 */
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  /** Whether the user is authenticated (has valid secret configured) */
  isAuthenticated: boolean;
  /** Whether a session expiry (401) has been detected */
  sessionExpired: boolean;
  /** Whether we're checking authentication status */
  isChecking: boolean;
  /** Last error message if any */
  lastError: string | null;
}

interface AuthContextValue extends AuthState {
  /** Mark session as expired (called on 401 errors) */
  markSessionExpired: () => void;
  /** Dismiss the session expired notification */
  dismissExpiredNotification: () => void;
  /** Retry authentication check */
  retryAuth: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: true, // Assume authenticated until proven otherwise
    sessionExpired: false,
    isChecking: false,
    lastError: null,
  });

  const markSessionExpired = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionExpired: true,
      isAuthenticated: false,
    }));
    // Invalidate all queries when session expires
    queryClient.invalidateQueries();
  }, [queryClient]);

  const dismissExpiredNotification = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sessionExpired: false,
    }));
  }, []);

  const retryAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isChecking: true, lastError: null }));

    try {
      // Try a simple authenticated endpoint to verify credentials
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const secret = import.meta.env.VITE_DASHBOARD_SECRET || '';

      const response = await fetch(`${baseUrl}/brains`, {
        headers: {
          'Content-Type': 'application/json',
          ...(secret && { 'X-Dashboard-Secret': secret }),
        },
      });

      if (response.ok) {
        setState({
          isAuthenticated: true,
          sessionExpired: false,
          isChecking: false,
          lastError: null,
        });
        // Refetch all queries after successful re-auth
        queryClient.refetchQueries();
      } else if (response.status === 401) {
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          sessionExpired: true,
          isChecking: false,
          lastError: 'Invalid authentication credentials',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          lastError: `Auth check failed: ${response.status}`,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isChecking: false,
        lastError: error instanceof Error ? error.message : 'Auth check failed',
      }));
    }
  }, [queryClient]);

  // Listen for global auth errors (401 responses)
  useEffect(() => {
    const handleAuthError = (event: CustomEvent<{ status: number; message?: string }>) => {
      if (event.detail.status === 401) {
        markSessionExpired();
      }
    };

    window.addEventListener('api-auth-error', handleAuthError as EventListener);
    return () => {
      window.removeEventListener('api-auth-error', handleAuthError as EventListener);
    };
  }, [markSessionExpired]);

  const value: AuthContextValue = {
    ...state,
    markSessionExpired,
    dismissExpiredNotification,
    retryAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// Utility: Dispatch auth error event
// ============================================================================

/**
 * Dispatch an auth error event (call this from API error handlers)
 */
export function dispatchAuthError(status: number, message?: string): void {
  window.dispatchEvent(
    new CustomEvent('api-auth-error', {
      detail: { status, message },
    })
  );
}

// ============================================================================
// Default export
// ============================================================================

export default useAuth;
