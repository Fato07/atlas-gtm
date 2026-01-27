/**
 * ResearchList component
 * Displays a filterable list of research documents
 */
import { useState } from 'react';
import { Search, Plus, Filter, X, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResearchCard, ResearchCardSkeleton } from './ResearchCard';
import {
  MarketResearch,
  ContentType,
  DocumentStatus,
  getContentTypeDisplayName,
} from '@/hooks/useResearch';
import { cn } from '@/lib/utils';

interface ResearchListProps {
  documents: MarketResearch[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  selectedDocId?: string;
  onSelectDocument?: (doc: MarketResearch) => void;
  onArchive?: (docId: string) => void;
  onDelete?: (docId: string) => void;
  onCreateNew?: () => void;
  // Filters
  contentTypeFilter?: ContentType;
  onContentTypeFilterChange?: (type: ContentType | undefined) => void;
  statusFilter?: DocumentStatus;
  onStatusFilterChange?: (status: DocumentStatus | undefined) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Tags
  availableTags?: string[];
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
}

const CONTENT_TYPES: ContentType[] = ['article', 'report', 'transcript', 'notes', 'other'];

export function ResearchList({
  documents,
  isLoading,
  isError,
  error,
  onRetry,
  selectedDocId,
  onSelectDocument,
  onArchive,
  onDelete,
  onCreateNew,
  contentTypeFilter,
  onContentTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery = '',
  onSearchChange,
  availableTags = [],
  selectedTags = [],
  onTagsChange,
}: ResearchListProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    contentTypeFilter !== undefined ||
    statusFilter !== undefined ||
    selectedTags.length > 0;

  const clearFilters = () => {
    onContentTypeFilterChange?.(undefined);
    onStatusFilterChange?.(undefined);
    onTagsChange?.([]);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange?.(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange?.([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with search and create button */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search research..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(hasActiveFilters && 'border-primary text-primary')}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Filters</h4>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Content Type Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Content Type
                  </label>
                  <Select
                    value={contentTypeFilter || 'all'}
                    onValueChange={(v) =>
                      onContentTypeFilterChange?.(v === 'all' ? undefined : (v as ContentType))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {CONTENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getContentTypeDisplayName(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <Select
                    value={statusFilter || 'all'}
                    onValueChange={(v) =>
                      onStatusFilterChange?.(v === 'all' ? undefined : (v as DocumentStatus))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags Filter */}
                {availableTags.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {availableTags.slice(0, 10).map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                      {availableTags.length > 10 && (
                        <span className="text-xs text-muted-foreground">
                          +{availableTags.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button size="icon" onClick={onCreateNew}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Active filters display */}
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {contentTypeFilter && (
              <Badge variant="secondary" className="text-xs">
                {getContentTypeDisplayName(contentTypeFilter)}
                <button
                  onClick={() => onContentTypeFilterChange?.(undefined)}
                  className="ml-1 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {statusFilter && (
              <Badge variant="secondary" className="text-xs">
                {statusFilter === 'active' ? 'Active' : 'Archived'}
                <button
                  onClick={() => onStatusFilterChange?.(undefined)}
                  className="ml-1 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
                <button
                  onClick={() => toggleTag(tag)}
                  className="ml-1 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Document count */}
      <div className="border-b border-border px-4 py-2">
        <span className="text-sm text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isError ? (
            <ErrorState
              message={error?.message || 'Failed to load research documents'}
              onRetry={onRetry}
            />
          ) : isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <ResearchCardSkeleton key={i} />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No research documents"
              description={
                hasActiveFilters || searchQuery
                  ? 'Try adjusting your filters or search'
                  : 'Create your first research document'
              }
              action={
                !hasActiveFilters && !searchQuery
                  ? { label: 'Add Research', onClick: () => onCreateNew?.(), icon: Plus }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <ResearchCard
                  key={doc.id}
                  document={doc}
                  isSelected={doc.id === selectedDocId}
                  onSelect={onSelectDocument}
                  onArchive={onArchive}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
