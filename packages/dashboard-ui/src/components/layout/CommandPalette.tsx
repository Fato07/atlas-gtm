import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Brain, Target, FileText, Settings, Activity } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScoreLeadDialog, GenerateBriefDialog } from '@/components/actions';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Command palette component (Cmd+K)
 * Provides quick navigation and action execution
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scoreLeadOpen, setScoreLeadOpen] = useState(false);
  const [generateBriefOpen, setGenerateBriefOpen] = useState(false);

  // Define available commands
  const commands: CommandItem[] = [
    // Navigation commands
    {
      id: 'home',
      label: 'Go to Dashboard',
      icon: <Home className="h-4 w-4" />,
      action: () => {
        navigate('/');
        onOpenChange(false);
      },
      keywords: ['home', 'dashboard', 'main'],
      shortcut: 'G D',
    },
    {
      id: 'brains',
      label: 'View Brains',
      icon: <Brain className="h-4 w-4" />,
      action: () => {
        navigate('/brains');
        onOpenChange(false);
      },
      keywords: ['brains', 'knowledge', 'kb'],
      shortcut: 'G B',
    },
    {
      id: 'activity',
      label: 'View Activity',
      icon: <Activity className="h-4 w-4" />,
      action: () => {
        navigate('/');
        onOpenChange(false);
      },
      keywords: ['activity', 'feed', 'events', 'log'],
      shortcut: 'G A',
    },

    // Manual trigger commands (US10)
    {
      id: 'score-lead',
      label: 'Score Lead',
      icon: <Target className="h-4 w-4" />,
      action: () => {
        onOpenChange(false);
        setScoreLeadOpen(true);
      },
      keywords: ['score', 'lead', 'icp', 'tier', 'evaluate'],
      shortcut: 'S L',
    },
    {
      id: 'generate-brief',
      label: 'Generate Meeting Brief',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        onOpenChange(false);
        setGenerateBriefOpen(true);
      },
      keywords: ['brief', 'meeting', 'prep', 'generate'],
      shortcut: 'G M',
    },

    // Settings
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        // TODO: Implement settings page
        onOpenChange(false);
      },
      keywords: ['settings', 'config', 'preferences'],
      shortcut: 'G S',
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
    );
  });

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard shortcut to open (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Handle keyboard navigation within palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [filteredCommands, selectedIndex, onOpenChange]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0" onKeyDown={handleKeyDown}>
          <DialogHeader className="sr-only">
            <DialogTitle>Command Palette</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="border-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>

          {/* Command list */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No commands found.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-muted-foreground">{cmd.icon}</span>
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="hidden rounded border bg-muted px-1.5 text-xs text-muted-foreground sm:inline-block">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              <kbd className="rounded border bg-muted px-1">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1">Enter</kbd> to select
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1">Esc</kbd> to close
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action dialogs - rendered outside command palette */}
      <ScoreLeadDialog open={scoreLeadOpen} onOpenChange={setScoreLeadOpen} />
      <GenerateBriefDialog open={generateBriefOpen} onOpenChange={setGenerateBriefOpen} />
    </>
  );
}
