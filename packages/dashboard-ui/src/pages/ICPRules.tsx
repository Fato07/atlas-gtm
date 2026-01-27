/**
 * ICPRulesPage
 * Split view for managing ICP rules with list on left, editor on right
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICPRuleList } from '@/components/icp-rules/ICPRuleList';
import { ICPRuleEditor, ICPRuleEditorEmpty } from '@/components/icp-rules/ICPRuleEditor';
import { BulkImportDialog } from '@/components/icp-rules/BulkImportDialog';
import {
  useICPRules,
  useCreateICPRule,
  useUpdateICPRule,
  useDeleteICPRule,
  useBulkImportICPRules,
  ICPRule,
  ICPCategory,
  CreateICPRuleRequest,
  UpdateICPRuleRequest,
} from '@/hooks/useICPRules';
import { useBrain } from '@/hooks/useBrains';

type EditorMode = 'view' | 'create' | 'edit';

export function ICPRulesPage() {
  const { brainId } = useParams<{ brainId: string }>();
  const navigate = useNavigate();

  // State
  const [selectedRule, setSelectedRule] = useState<ICPRule | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [categoryFilter, setCategoryFilter] = useState<ICPCategory | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Data fetching
  const { data: brain, isLoading: isBrainLoading } = useBrain(brainId);
  const { data, isLoading: isRulesLoading, isError } = useICPRules(brainId, {
    category: categoryFilter,
    search: searchQuery || undefined,
  });

  // Mutations
  const createMutation = useCreateICPRule(brainId!);
  const updateMutation = useUpdateICPRule(brainId!, selectedRule?.id ?? '');
  const deleteMutation = useDeleteICPRule(brainId!);
  const bulkImportMutation = useBulkImportICPRules(brainId!);

  const rules = data?.rules ?? [];

  // Handlers
  const handleSelectRule = useCallback((rule: ICPRule) => {
    setSelectedRule(rule);
    setEditorMode('edit');
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedRule(null);
    setEditorMode('create');
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedRule(null);
    setEditorMode('view');
  }, []);

  const handleSave = useCallback(
    async (formData: CreateICPRuleRequest | UpdateICPRuleRequest) => {
      if (editorMode === 'create') {
        const result = await createMutation.mutateAsync(formData as CreateICPRuleRequest);
        setSelectedRule(result.rule);
        setEditorMode('edit');
      } else if (selectedRule) {
        await updateMutation.mutateAsync(formData as UpdateICPRuleRequest);
      }
    },
    [editorMode, selectedRule, createMutation, updateMutation]
  );

  const handleDelete = useCallback(
    async (ruleId: string) => {
      await deleteMutation.mutateAsync(ruleId);
      if (selectedRule?.id === ruleId) {
        setSelectedRule(null);
        setEditorMode('view');
      }
    },
    [deleteMutation, selectedRule]
  );

  const handleBulkImport = useCallback(
    async (data: { rules: CreateICPRuleRequest[]; replace_existing?: boolean }) => {
      const result = await bulkImportMutation.mutateAsync(data);
      return result;
    },
    [bulkImportMutation]
  );

  // Loading state
  if (isBrainLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (isError || !brain) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/brains')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brains
        </Button>
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-12 text-center dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Failed to load brain
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The brain could not be loaded.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/brains')}
            className="mt-4"
          >
            Go to Brain List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/brains/${brainId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">ICP Rules</h1>
            <p className="text-sm text-muted-foreground">{brain.name}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Rule list */}
        <div className="w-[400px] shrink-0 border-r border-border">
          <ICPRuleList
            rules={rules}
            isLoading={isRulesLoading}
            selectedRuleId={selectedRule?.id}
            onSelectRule={handleSelectRule}
            onDeleteRule={handleDelete}
            onCreateNew={handleCreateNew}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right panel - Editor */}
        <div className="flex-1 overflow-hidden">
          {editorMode === 'view' ? (
            <ICPRuleEditorEmpty onCreateNew={handleCreateNew} />
          ) : (
            <ICPRuleEditor
              rule={editorMode === 'edit' ? selectedRule ?? undefined : undefined}
              brainId={brainId!}
              isCreating={editorMode === 'create'}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
              onSave={handleSave}
              onDelete={
                selectedRule
                  ? () => handleDelete(selectedRule.id)
                  : undefined
              }
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImport={handleBulkImport}
        isImporting={bulkImportMutation.isPending}
      />
    </div>
  );
}
