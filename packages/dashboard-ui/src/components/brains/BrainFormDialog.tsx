/**
 * BrainFormDialog component
 * Dialog for creating, editing, or cloning brains
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Brain,
  useCreateBrain,
  useUpdateBrain,
  CreateBrainRequest,
  UpdateBrainRequest,
} from '@/hooks/useBrains';

// Common verticals
const VERTICALS = [
  { value: 'fintech', label: 'FinTech' },
  { value: 'saas', label: 'B2B SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'edtech', label: 'EdTech' },
  { value: 'martech', label: 'MarTech' },
  { value: 'proptech', label: 'PropTech' },
  { value: 'other', label: 'Other' },
];

interface BrainFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit' | 'clone';
  brain?: Brain;
  onClone?: (newName: string) => void;
}

export function BrainFormDialog({
  open,
  onOpenChange,
  mode,
  brain,
  onClone,
}: BrainFormDialogProps) {
  const [name, setName] = useState('');
  const [vertical, setVertical] = useState('');
  const [customVertical, setCustomVertical] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [companySizes, setCompanySizes] = useState('');
  const [geoFocus, setGeoFocus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateBrain();
  const updateMutation = useUpdateBrain(brain?.brain_id ?? '');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        setName('');
        setVertical('');
        setCustomVertical('');
        setTargetRoles('');
        setCompanySizes('');
        setGeoFocus('');
      } else if (brain) {
        setName(mode === 'clone' ? `${brain.name} (Copy)` : brain.name);
        const matchingVertical = VERTICALS.find(
          (v) => v.value === brain.vertical
        );
        if (matchingVertical) {
          setVertical(brain.vertical);
          setCustomVertical('');
        } else {
          setVertical('other');
          setCustomVertical(brain.vertical);
        }
        setTargetRoles(brain.config.target_roles.join(', '));
        setCompanySizes(brain.config.target_company_sizes.join(', '));
        setGeoFocus(brain.config.geo_focus.join(', '));
      }
      setError(null);
    }
  }, [open, mode, brain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const finalVertical =
      vertical === 'other' ? customVertical.trim() : vertical;
    if (!finalVertical) {
      setError('Vertical is required');
      return;
    }

    // Parse arrays from comma-separated strings
    const parseList = (s: string) =>
      s
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    try {
      if (mode === 'create') {
        const data: CreateBrainRequest = {
          name: name.trim(),
          vertical: finalVertical,
          config: {
            vertical: finalVertical,
            target_roles: parseList(targetRoles),
            target_company_sizes: parseList(companySizes),
            geo_focus: parseList(geoFocus),
          },
        };
        await createMutation.mutateAsync(data);
        onOpenChange(false);
      } else if (mode === 'edit' && brain) {
        const data: UpdateBrainRequest = {
          name: name.trim(),
          config: {
            vertical: finalVertical,
            target_roles: parseList(targetRoles),
            target_company_sizes: parseList(companySizes),
            geo_focus: parseList(geoFocus),
          },
        };
        await updateMutation.mutateAsync(data);
        onOpenChange(false);
      } else if (mode === 'clone' && onClone) {
        onClone(name.trim());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    }
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending;

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Brain';
      case 'edit':
        return 'Edit Brain';
      case 'clone':
        return 'Clone Brain';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'create':
        return 'Create a new brain for a specific vertical.';
      case 'edit':
        return 'Update brain configuration and settings.';
      case 'clone':
        return `Create a copy of "${brain?.name}" with a new name.`;
    }
  };

  const getSubmitLabel = () => {
    switch (mode) {
      case 'create':
        return isLoading ? 'Creating...' : 'Create Brain';
      case 'edit':
        return isLoading ? 'Saving...' : 'Save Changes';
      case 'clone':
        return isLoading ? 'Cloning...' : 'Clone Brain';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., FinTech Startups"
                disabled={isLoading}
              />
            </div>

            {/* Vertical */}
            {mode !== 'clone' && (
              <div className="space-y-2">
                <label
                  htmlFor="vertical"
                  className="text-sm font-medium leading-none"
                >
                  Vertical
                </label>
                <select
                  id="vertical"
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a vertical...</option>
                  {VERTICALS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {vertical === 'other' && (
                  <Input
                    value={customVertical}
                    onChange={(e) => setCustomVertical(e.target.value)}
                    placeholder="Enter custom vertical"
                    disabled={isLoading}
                  />
                )}
              </div>
            )}

            {/* Target Roles */}
            {mode !== 'clone' && (
              <div className="space-y-2">
                <label
                  htmlFor="target-roles"
                  className="text-sm font-medium leading-none"
                >
                  Target Roles
                  <span className="ml-1 text-xs text-muted-foreground">
                    (comma-separated)
                  </span>
                </label>
                <Input
                  id="target-roles"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="e.g., CTO, VP Engineering, Head of Product"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Company Sizes */}
            {mode !== 'clone' && (
              <div className="space-y-2">
                <label
                  htmlFor="company-sizes"
                  className="text-sm font-medium leading-none"
                >
                  Company Sizes
                  <span className="ml-1 text-xs text-muted-foreground">
                    (comma-separated)
                  </span>
                </label>
                <Input
                  id="company-sizes"
                  value={companySizes}
                  onChange={(e) => setCompanySizes(e.target.value)}
                  placeholder="e.g., 11-50, 51-200, 201-500"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Geo Focus */}
            {mode !== 'clone' && (
              <div className="space-y-2">
                <label
                  htmlFor="geo-focus"
                  className="text-sm font-medium leading-none"
                >
                  Geographic Focus
                  <span className="ml-1 text-xs text-muted-foreground">
                    (comma-separated)
                  </span>
                </label>
                <Input
                  id="geo-focus"
                  value={geoFocus}
                  onChange={(e) => setGeoFocus(e.target.value)}
                  placeholder="e.g., US, UK, EU"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getSubmitLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
