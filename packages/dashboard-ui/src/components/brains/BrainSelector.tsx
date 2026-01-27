/**
 * BrainSelector component
 * Dropdown for selecting active brain in the header
 */
import { useState } from 'react';
import { Brain, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useBrains,
  useActivateBrain,
  Brain as BrainType,
  getBrainStatusColor,
} from '@/hooks/useBrains';
import { useBrainContext } from '@/contexts/BrainContext';
import { cn } from '@/lib/utils';

interface BrainSelectorProps {
  onCreateNew?: () => void;
  onViewAll?: () => void;
}

export function BrainSelector({ onCreateNew, onViewAll }: BrainSelectorProps) {
  const [open, setOpen] = useState(false);
  const { selectedBrain, selectBrain } = useBrainContext();
  const { data: brains, isLoading } = useBrains();
  const activateMutation = useActivateBrain();

  const handleSelect = async (brain: BrainType) => {
    // Convert from BrainType (with brain_id) to context Brain (with id)
    selectBrain({
      id: brain.brain_id,
      name: brain.name,
      vertical: brain.vertical,
      status: brain.status,
    });
    setOpen(false);
  };

  const handleActivate = async (brainId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await activateMutation.mutateAsync(brainId);
      selectBrain({
        id: result.brain.brain_id,
        name: result.brain.name,
        vertical: result.brain.vertical,
        status: result.brain.status,
      });
    } catch (error) {
      console.error('Failed to activate brain:', error);
    }
  };

  // Group brains by status
  const activeBrains = brains?.filter((b) => b.status === 'active') ?? [];
  const draftBrains = brains?.filter((b) => b.status === 'draft') ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Brain className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedBrain?.name ?? 'Select brain...'}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Active brains */}
            {activeBrains.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Active
                </DropdownMenuLabel>
                {activeBrains.map((brain) => (
                  <BrainMenuItem
                    key={brain.brain_id}
                    brain={brain}
                    isSelected={selectedBrain?.id === brain.brain_id}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}

            {/* Draft brains */}
            {draftBrains.length > 0 && (
              <>
                {activeBrains.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Draft
                </DropdownMenuLabel>
                {draftBrains.map((brain) => (
                  <BrainMenuItem
                    key={brain.brain_id}
                    brain={brain}
                    isSelected={selectedBrain?.id === brain.brain_id}
                    onSelect={handleSelect}
                    onActivate={handleActivate}
                    isActivating={
                      activateMutation.isPending &&
                      activateMutation.variables === brain.brain_id
                    }
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {brains?.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No brains found
              </div>
            )}

            {/* Actions */}
            <DropdownMenuSeparator />
            {onViewAll && (
              <DropdownMenuItem
                onClick={() => {
                  setOpen(false);
                  onViewAll();
                }}
              >
                View all brains
              </DropdownMenuItem>
            )}
            {onCreateNew && (
              <DropdownMenuItem
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new brain
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Individual brain menu item
 */
interface BrainMenuItemProps {
  brain: BrainType;
  isSelected: boolean;
  onSelect: (brain: BrainType) => void;
  onActivate?: (brainId: string, e: React.MouseEvent) => void;
  isActivating?: boolean;
}

function BrainMenuItem({
  brain,
  isSelected,
  onSelect,
  onActivate,
  isActivating,
}: BrainMenuItemProps) {
  return (
    <DropdownMenuItem
      className="flex items-center justify-between"
      onClick={() => onSelect(brain)}
    >
      <div className="flex items-center gap-2 truncate">
        {isSelected && <Check className="h-4 w-4 shrink-0" />}
        {!isSelected && <div className="w-4" />}
        <span className="truncate">{brain.name}</span>
      </div>
      {brain.status === 'draft' && onActivate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => onActivate(brain.brain_id, e)}
          disabled={isActivating}
        >
          {isActivating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            'Activate'
          )}
        </Button>
      )}
    </DropdownMenuItem>
  );
}

/**
 * Compact version for smaller spaces
 */
export function BrainSelectorCompact() {
  const { selectedBrain } = useBrainContext();

  if (!selectedBrain) {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Brain className="h-4 w-4" />
        <span>No brain selected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Brain className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{selectedBrain.name}</span>
      <span
        className={cn(
          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
          getBrainStatusColor(selectedBrain.status)
        )}
      >
        {selectedBrain.status}
      </span>
    </div>
  );
}
