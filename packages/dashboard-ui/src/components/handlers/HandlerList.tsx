/**
 * HandlerList component
 * Displays a list of objection handlers with search and filter
 */
import { useState } from 'react';
import { Search, Plus, MessageSquare, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HandlerRow, HandlerRowSkeleton } from './HandlerRow';
import {
  ObjectionHandler,
  ObjectionType,
  OBJECTION_TYPES,
  getObjectionTypeDisplayName,
} from '@/hooks/useHandlers';

interface HandlerListProps {
  handlers: ObjectionHandler[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  selectedHandlerId?: string;
  onSelectHandler: (handler: ObjectionHandler) => void;
  onDeleteHandler?: (handlerId: string) => void;
  onCreateNew: () => void;
  objectionTypeFilter?: ObjectionType;
  onObjectionTypeFilterChange: (type: ObjectionType | undefined) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function HandlerList({
  handlers,
  isLoading,
  isError,
  error,
  onRetry,
  selectedHandlerId,
  onSelectHandler,
  onDeleteHandler,
  onCreateNew,
  objectionTypeFilter,
  onObjectionTypeFilterChange,
  searchQuery,
  onSearchChange,
}: HandlerListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (handlerId: string) => {
    if (deleteConfirmId === handlerId) {
      onDeleteHandler?.(handlerId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(handlerId);
      // Reset after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  // Group handlers by objection type
  const groupedHandlers = handlers.reduce(
    (groups, handler) => {
      const type = handler.objection_type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(handler);
      return groups;
    },
    {} as Record<ObjectionType, ObjectionHandler[]>
  );

  // Get sorted type keys (only types with handlers)
  const typeKeys = OBJECTION_TYPES.filter((type) => groupedHandlers[type]?.length > 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Handlers</h2>
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search triggers, responses..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter */}
        <div className="mt-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={objectionTypeFilter || 'all'}
            onValueChange={(v) =>
              onObjectionTypeFilterChange(v === 'all' ? undefined : (v as ObjectionType))
            }
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {OBJECTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getObjectionTypeDisplayName(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Handler list */}
      <div className="flex-1 overflow-y-auto">
        {isError ? (
          <div className="p-4">
            <ErrorState
              message={error?.message || 'Failed to load handlers'}
              onRetry={onRetry}
            />
          </div>
        ) : isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <HandlerRowSkeleton key={i} />
            ))}
          </div>
        ) : handlers.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No handlers found"
            description={
              searchQuery || objectionTypeFilter
                ? 'Try adjusting your filters'
                : 'Create your first objection handler'
            }
            action={
              !searchQuery && !objectionTypeFilter
                ? { label: 'Create Handler', onClick: onCreateNew, icon: Plus }
                : undefined
            }
          />
        ) : objectionTypeFilter ? (
          // Flat list when filtered by type
          handlers.map((handler) => (
            <HandlerRow
              key={handler.id}
              handler={handler}
              isSelected={selectedHandlerId === handler.id}
              onClick={() => onSelectHandler(handler)}
              onDelete={onDeleteHandler ? () => handleDeleteClick(handler.id) : undefined}
            />
          ))
        ) : (
          // Grouped list by objection type
          typeKeys.map((type) => (
            <div key={type}>
              {/* Group header */}
              <div className="sticky top-0 z-10 border-b border-border bg-muted/50 px-4 py-2">
                <h3 className="text-sm font-medium text-foreground">
                  {getObjectionTypeDisplayName(type)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {groupedHandlers[type].length} handler
                  {groupedHandlers[type].length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Group items */}
              {groupedHandlers[type].map((handler) => (
                <HandlerRow
                  key={handler.id}
                  handler={handler}
                  isSelected={selectedHandlerId === handler.id}
                  onClick={() => onSelectHandler(handler)}
                  onDelete={onDeleteHandler ? () => handleDeleteClick(handler.id) : undefined}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Count footer */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {handlers.length} handler{handlers.length !== 1 ? 's' : ''}
        {objectionTypeFilter && ` (${getObjectionTypeDisplayName(objectionTypeFilter)})`}
      </div>
    </div>
  );
}
