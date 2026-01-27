import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/error';
import { Layout } from './components/layout/Layout';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './contexts/ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { BrainList } from './pages/BrainList';
import { BrainDetail } from './pages/BrainDetail';
import { ICPRulesPage } from './pages/ICPRules';
import { TemplatesPage } from './pages/Templates';
import { HandlersPage } from './pages/Handlers';
import { ResearchPage } from './pages/Research';
import './styles/globals.css';

/**
 * Global keyboard shortcuts component
 * Supports vim-like "G D", "G B" navigation sequences
 * Must be rendered inside BrowserRouter
 */
function KeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let pendingKey: string | null = null;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle two-key sequences (G D, G B, etc.)
      if (pendingKey === 'g') {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingKey = null;

        switch (e.key.toLowerCase()) {
          case 'd': // G D -> Dashboard
            e.preventDefault();
            navigate('/');
            break;
          case 'b': // G B -> Brains
            e.preventDefault();
            navigate('/brains');
            break;
          case 'a': // G A -> Activity (dashboard with activity focus)
            e.preventDefault();
            navigate('/');
            break;
        }
        return;
      }

      // Start sequence with "G"
      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        pendingKey = 'g';
        // Clear pending after 1 second
        pendingTimeout = setTimeout(() => {
          pendingKey = null;
        }, 1000);
        return;
      }

      // Escape key closes dialogs/modals (handled by individual components)
      // Cmd+K is handled by CommandPalette component
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [navigate]);

  return null;
}

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

// Root component with providers and routing
function Root() {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <KeyboardShortcuts />
            <Routes>
            <Route path="/" element={<><Layout /><Toaster /></>}>
              {/* Dashboard - home page */}
              <Route index element={<Dashboard />} />

              {/* Brain management routes - US3 */}
              <Route path="brains" element={<BrainList />} />
              <Route path="brains/:brainId" element={<BrainDetail />} />

              {/* ICP Rules - US4 */}
              <Route path="brains/:brainId/icp-rules" element={<ICPRulesPage />} />

              {/* Templates - US5 */}
              <Route path="brains/:brainId/templates" element={<TemplatesPage />} />

              {/* Handlers - US6 */}
              <Route path="brains/:brainId/handlers" element={<HandlersPage />} />

              {/* Research - US7 */}
              <Route path="brains/:brainId/research" element={<ResearchPage />} />

                {/* Catch-all redirect to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
  );
}

// Mount app
ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
