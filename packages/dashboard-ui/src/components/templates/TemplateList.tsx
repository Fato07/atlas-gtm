/**
 * TemplateList component
 * Left panel showing all templates grouped by reply type
 */
import { useCallback, useMemo } from 'react';
import { Plus, Search, Filter, Mail } from 'lucide-react';
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
import { TemplateRow, TemplateRowSkeleton } from './TemplateRow';
import {
  ResponseTemplate,
  ReplyType,
  REPLY_TYPES,
  getReplyTypeDisplayName,
} from '@/hooks/useTemplates';

interface TemplateListProps {
  templates: ResponseTemplate[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  selectedTemplateId?: string;
  onSelectTemplate: (template: ResponseTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCreateNew: () => void;
  replyTypeFilter?: ReplyType;
  onReplyTypeFilterChange: (replyType: ReplyType | undefined) => void;
  searchQuery?: string;
  onSearchChange: (query: string) => void;
}

export function TemplateList({
  templates,
  isLoading,
  isError,
  error,
  onRetry,
  selectedTemplateId,
  onSelectTemplate,
  onDeleteTemplate,
  onCreateNew,
  replyTypeFilter,
  onReplyTypeFilterChange,
  searchQuery,
  onSearchChange,
}: TemplateListProps) {
  // Memoize grouped templates to prevent recalculation on each render
  const groupedTemplates = useMemo(
    () =>
      templates.reduce(
        (acc, template) => {
          if (!acc[template.reply_type]) {
            acc[template.reply_type] = [];
          }
          acc[template.reply_type].push(template);
          return acc;
        },
        {} as Record<ReplyType, ResponseTemplate[]>
      ),
    [templates]
  );

  // Stable callback creators to prevent new function references on each render
  const handleTemplateClick = useCallback(
    (template: ResponseTemplate) => () => onSelectTemplate(template),
    [onSelectTemplate]
  );

  const handleTemplateDelete = useCallback(
    (templateId: string) => () => onDeleteTemplate(templateId),
    [onDeleteTemplate]
  );

  // Order reply types
  const orderedReplyTypes = REPLY_TYPES.filter(
    (type) => !replyTypeFilter || type === replyTypeFilter
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates</h2>
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-1 h-4 w-4" />
            Add Template
          </Button>
        </div>

        {/* Search and filter */}
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={replyTypeFilter ?? 'all'}
            onValueChange={(value) =>
              onReplyTypeFilterChange(
                value === 'all' ? undefined : (value as ReplyType)
              )
            }
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Reply Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {REPLY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getReplyTypeDisplayName(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isError ? (
          <ErrorState
            message={error?.message || 'Failed to load templates'}
            onRetry={onRetry}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <TemplateRowSkeleton key={i} />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={
              searchQuery || replyTypeFilter
                ? 'No templates match your filters'
                : 'No templates yet'
            }
            description={
              searchQuery || replyTypeFilter
                ? 'Try adjusting your search or filters'
                : 'Create response templates for different reply types'
            }
            action={
              !searchQuery && !replyTypeFilter
                ? { label: 'Create your first template', onClick: onCreateNew, icon: Plus }
                : undefined
            }
          />
        ) : replyTypeFilter || searchQuery ? (
          // Show flat list when filtered (templates already filtered by parent)
          <div className="space-y-2">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                isSelected={template.id === selectedTemplateId}
                onClick={handleTemplateClick(template)}
                onDelete={handleTemplateDelete(template.id)}
              />
            ))}
          </div>
        ) : (
          // Show grouped list when no filter
          <div className="space-y-6">
            {orderedReplyTypes.map((replyType) => {
              const typeTemplates = groupedTemplates[replyType];
              if (!typeTemplates || typeTemplates.length === 0) return null;

              return (
                <div key={replyType}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getReplyTypeDisplayName(replyType)} ({typeTemplates.length})
                  </h3>
                  <div className="space-y-2">
                    {typeTemplates.map((template) => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        isSelected={template.id === selectedTemplateId}
                        onClick={handleTemplateClick(template)}
                        onDelete={handleTemplateDelete(template.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {templates.length} template{templates.length !== 1 ? 's' : ''}{' '}
        {replyTypeFilter && `for ${getReplyTypeDisplayName(replyTypeFilter)}`}
      </div>
    </div>
  );
}
