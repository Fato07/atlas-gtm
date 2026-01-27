import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Command, Bell, Settings, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from './CommandPalette';
import { SettingsDialog } from './SettingsDialog';
import { BrainSelector } from '@/components/brains/BrainSelector';
import { useQdrantStatus } from '@/hooks/useSystemHealth';

interface HeaderProps {
  onMenuToggle?: () => void;
  pendingCount?: number;
}

/**
 * Dashboard header component
 * Contains logo, brain selector (placeholder), command palette trigger, and notifications
 */
export function Header({ onMenuToggle, pendingCount = 0 }: HeaderProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { isConnected: qdrantConnected, isLoading: qdrantLoading } = useQdrantStatus();

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm">
        {/* Left section: Menu + Logo */}
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuToggle}
              className="lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="font-bold text-primary-foreground">A</span>
            </div>
            <span className="hidden font-semibold text-foreground sm:inline-block">
              Atlas
            </span>
          </Link>

          {/* Qdrant connection status indicator */}
          <div
            className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:flex"
            title={qdrantConnected ? 'Qdrant connected' : 'Qdrant disconnected'}
            role="status"
            aria-label={`Knowledge base ${qdrantConnected ? 'connected' : 'disconnected'}`}
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            <span
              className={`h-2 w-2 rounded-full ${
                qdrantLoading
                  ? 'animate-pulse bg-muted-foreground'
                  : qdrantConnected
                    ? 'bg-success'
                    : 'bg-error'
              }`}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {qdrantLoading ? 'Checking...' : qdrantConnected ? 'KB' : 'KB Offline'}
            </span>
          </div>
        </div>

        {/* Center section: Brain selector */}
        <div className="hidden md:flex">
          <BrainSelector
            onCreateNew={() => navigate('/brains?create=true')}
            onViewAll={() => navigate('/brains')}
          />
        </div>

        {/* Right section: Actions */}
        <div className="flex items-center gap-2">
          {/* Command palette trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden gap-2 sm:flex"
          >
            <Command className="h-4 w-4" />
            <span className="text-muted-foreground">Search...</span>
            <kbd className="pointer-events-none ml-2 hidden rounded border bg-muted px-1.5 text-xs text-muted-foreground lg:inline-block">
              ⌘K
            </kbd>
          </Button>

          {/* Mobile command palette trigger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandPaletteOpen(true)}
            className="sm:hidden"
            aria-label="Open command palette"
          >
            <Command className="h-5 w-5" />
          </Button>

          {/* Notifications with badge */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs font-medium text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
