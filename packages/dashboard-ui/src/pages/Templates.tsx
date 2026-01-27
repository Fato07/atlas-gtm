/**
 * Templates Page
 * Split-view layout for managing response templates
 */
import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateList } from '@/components/templates/TemplateList';
import { TemplateEditor, TemplateEditorEmpty } from '@/components/templates/TemplateEditor';
import { useBrainContext } from '@/contexts/BrainContext';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  usePreviewTemplate,
  ResponseTemplate,
  ReplyType,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@/hooks/useTemplates';

export function TemplatesPage() {
  const { brainId } = useParams<{ brainId: string }>();
  const navigate = useNavigate();
  const { selectedBrain } = useBrainContext();

  // State
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [replyTypeFilter, setReplyTypeFilter] = useState<ReplyType | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Use brainId from URL or selected brain
  const effectiveBrainId = brainId || selectedBrain?.id;

  // Memoize query params to prevent new object identity on each render
  const queryParams = useMemo(
    () => (replyTypeFilter ? { reply_type: replyTypeFilter } : undefined),
    [replyTypeFilter]
  );

  // Queries
  const { data, isLoading } = useTemplates(effectiveBrainId, queryParams);

  // Mutations
  const createMutation = useCreateTemplate(effectiveBrainId ?? '');
  const updateMutation = useUpdateTemplate(
    effectiveBrainId ?? '',
    selectedTemplate?.id ?? ''
  );
  const deleteMutation = useDeleteTemplate(effectiveBrainId ?? '');
  const previewMutation = usePreviewTemplate(effectiveBrainId ?? '');

  // Filter templates by search - memoized to prevent new array on each render
  const filteredTemplates = useMemo(() => {
    const templates = data?.templates ?? [];
    if (!searchQuery) return templates;
    return templates.filter((template) =>
      template.template_text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.templates, searchQuery]);

  // Handlers
  const handleSelectTemplate = (template: ResponseTemplate) => {
    setSelectedTemplate(template);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
    setIsCreating(false);
  };

  const handleSave = async (formData: CreateTemplateRequest | UpdateTemplateRequest) => {
    if (isCreating) {
      const newTemplate = await createMutation.mutateAsync(formData as CreateTemplateRequest);
      setSelectedTemplate(newTemplate);
      setIsCreating(false);
    } else if (selectedTemplate) {
      const updated = await updateMutation.mutateAsync(formData as UpdateTemplateRequest);
      setSelectedTemplate(updated);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    await deleteMutation.mutateAsync(selectedTemplate.id);
    setSelectedTemplate(null);
  };

  const handleDeleteFromList = async (templateId: string) => {
    await deleteMutation.mutateAsync(templateId);
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null);
    }
  };

  const handlePreview = useCallback(
    async (text: string) => {
      const result = await previewMutation.mutateAsync({ templateText: text });
      return result;
    },
    [previewMutation.mutateAsync]
  );

  const handleBackToBrain = () => {
    if (brainId) {
      navigate(`/brains/${brainId}`);
    } else {
      navigate('/brains');
    }
  };

  if (!effectiveBrainId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Please select a brain to manage templates</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToBrain}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Response Templates</h1>
            <p className="text-sm text-muted-foreground">
              {selectedBrain?.name || brainId}
            </p>
          </div>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Template list */}
        <div className="w-96 border-r border-border">
          <TemplateList
            templates={filteredTemplates}
            isLoading={isLoading}
            selectedTemplateId={selectedTemplate?.id}
            onSelectTemplate={handleSelectTemplate}
            onDeleteTemplate={handleDeleteFromList}
            onCreateNew={handleCreateNew}
            replyTypeFilter={replyTypeFilter}
            onReplyTypeFilterChange={setReplyTypeFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right panel - Editor */}
        <div className="flex-1 overflow-y-auto">
          {isCreating || selectedTemplate ? (
            <TemplateEditor
              template={selectedTemplate ?? undefined}
              brainId={effectiveBrainId}
              isCreating={isCreating}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isDeleting={deleteMutation.isPending}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onPreview={handlePreview}
            />
          ) : (
            <TemplateEditorEmpty onCreateNew={handleCreateNew} />
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplatesPage;
