/**
 * ICPRuleList component
 * Left panel showing all ICP rules grouped by category
 */
import { Plus, Search, Filter, Target } from 'lucide-react';
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
import { ICPRuleRow, ICPRuleRowSkeleton } from './ICPRuleRow';
import {
  ICPRule,
  ICPCategory,
  ICP_CATEGORIES,
  getCategoryDisplayName,
} from '@/hooks/useICPRules';

interface ICPRuleListProps {
  rules: ICPRule[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  selectedRuleId?: string;
  onSelectRule: (rule: ICPRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onCreateNew: () => void;
  categoryFilter?: ICPCategory;
  onCategoryFilterChange: (category: ICPCategory | undefined) => void;
  searchQuery?: string;
  onSearchChange: (query: string) => void;
}

export function ICPRuleList({
  rules,
  isLoading,
  isError,
  error,
  onRetry,
  selectedRuleId,
  onSelectRule,
  onDeleteRule,
  onCreateNew,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchChange,
}: ICPRuleListProps) {
  // Group rules by category for display
  const groupedRules = rules.reduce(
    (acc, rule) => {
      if (!acc[rule.category]) {
        acc[rule.category] = [];
      }
      acc[rule.category].push(rule);
      return acc;
    },
    {} as Record<ICPCategory, ICPRule[]>
  );

  // Order categories
  const orderedCategories = ICP_CATEGORIES.filter(
    (cat) => !categoryFilter || cat === categoryFilter
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">ICP Rules</h2>
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="mr-1 h-4 w-4" />
            Add Rule
          </Button>
        </div>

        {/* Search and filter */}
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter ?? 'all'}
            onValueChange={(value) =>
              onCategoryFilterChange(value === 'all' ? undefined : (value as ICPCategory))
            }
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ICP_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {getCategoryDisplayName(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rule list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isError ? (
          <ErrorState
            message={error?.message || 'Failed to load ICP rules'}
            onRetry={onRetry}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ICPRuleRowSkeleton key={i} />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Target}
            title={
              searchQuery || categoryFilter
                ? 'No rules match your filters'
                : 'No ICP rules yet'
            }
            description={
              searchQuery || categoryFilter
                ? 'Try adjusting your search or filters'
                : 'Define your ideal customer profile rules'
            }
            action={
              !searchQuery && !categoryFilter
                ? { label: 'Create your first rule', onClick: onCreateNew, icon: Plus }
                : undefined
            }
          />
        ) : categoryFilter ? (
          // Show flat list when filtered by category
          <div className="space-y-2">
            {rules.map((rule) => (
              <ICPRuleRow
                key={rule.id}
                rule={rule}
                isSelected={rule.id === selectedRuleId}
                onClick={() => onSelectRule(rule)}
                onDelete={() => onDeleteRule(rule.id)}
              />
            ))}
          </div>
        ) : (
          // Show grouped list when no category filter
          <div className="space-y-6">
            {orderedCategories.map((category) => {
              const categoryRules = groupedRules[category];
              if (!categoryRules || categoryRules.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getCategoryDisplayName(category)} ({categoryRules.length})
                  </h3>
                  <div className="space-y-2">
                    {categoryRules.map((rule) => (
                      <ICPRuleRow
                        key={rule.id}
                        rule={rule}
                        isSelected={rule.id === selectedRuleId}
                        onClick={() => onSelectRule(rule)}
                        onDelete={() => onDeleteRule(rule.id)}
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
        {rules.length} rule{rules.length !== 1 ? 's' : ''} total
        {categoryFilter && ` in ${getCategoryDisplayName(categoryFilter)}`}
      </div>
    </div>
  );
}
