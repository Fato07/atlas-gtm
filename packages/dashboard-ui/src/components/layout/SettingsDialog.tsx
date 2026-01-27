/**
 * SettingsDialog - Application settings dialog
 *
 * Includes theme selection and other app-wide settings
 */
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themes = [
  {
    value: 'light' as const,
    label: 'Light',
    icon: Sun,
    description: 'Light theme for daytime use',
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    icon: Moon,
    description: 'Dark theme for nighttime use',
  },
  {
    value: 'system' as const,
    label: 'System',
    icon: Monitor,
    description: 'Follows your system preference',
  },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your Atlas dashboard experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Selection */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Select your preferred color theme
              </p>
            </div>

            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
              className="grid grid-cols-3 gap-3"
            >
              {themes.map((item) => (
                <Label
                  key={item.value}
                  htmlFor={`theme-${item.value}`}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent',
                    theme === item.value
                      ? 'border-primary bg-accent'
                      : 'border-transparent bg-muted/50'
                  )}
                >
                  <RadioGroupItem
                    value={item.value}
                    id={`theme-${item.value}`}
                    className="sr-only"
                  />
                  <item.icon className={cn(
                    'h-6 w-6',
                    theme === item.value ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    theme === item.value ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {item.label}
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {theme === 'system' && (
              <p className="text-xs text-muted-foreground">
                Currently using: <span className="font-medium capitalize">{resolvedTheme}</span> mode
              </p>
            )}
          </div>

          {/* API Information (Read-only) */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-medium">API Endpoint</Label>
              <p className="text-sm text-muted-foreground">
                Dashboard API connection
              </p>
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-sm">
              {import.meta.env.VITE_API_URL}
            </div>
          </div>

          {/* Version Info */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dashboard Version</span>
              <span className="font-medium">v0.1.0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Build</span>
              <span className="font-mono text-xs text-muted-foreground">
                {import.meta.env.MODE}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
