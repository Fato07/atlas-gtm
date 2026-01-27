import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BrainProvider } from '@/contexts/BrainContext';
import { usePendingCounts } from '@/hooks/usePending';

/**
 * Main layout component
 * Provides the app shell with header and content area
 */
export function Layout() {
  const { data: pendingCounts } = usePendingCounts({
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <BrainProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header with pending count badge */}
        <Header pendingCount={pendingCounts?.total ?? 0} />

        {/* Main content area */}
        <main className="flex-1">
          <div className="container mx-auto max-w-7xl px-4 py-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-muted/30 py-4">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
              <p>Atlas GTM Operator Dashboard</p>
              <p>v0.1.0</p>
            </div>
          </div>
        </footer>
      </div>
    </BrainProvider>
  );
}
