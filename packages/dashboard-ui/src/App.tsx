import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrainProvider } from './contexts/BrainContext';
import { AuthProvider } from './hooks/useAuth';
import { SessionExpiredNotification } from './components/layout/SessionExpiredNotification';

// Create React Query client with defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

interface AppProps {
  children: React.ReactNode;
}

/**
 * App shell with providers
 * Wraps children with React Query, Auth, and Brain context
 *
 * Note: Keyboard shortcuts are handled in main.tsx (KeyboardShortcuts component)
 * This file is kept for potential standalone usage or testing
 */
export function App({ children }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrainProvider>
          {children}
          <SessionExpiredNotification />
        </BrainProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
