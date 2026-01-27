/**
 * Research Page
 * Split-view layout for managing market research documents
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResearchList } from '@/components/research/ResearchList';
import { ResearchEditor } from '@/components/research/ResearchEditor';
import { ResearchViewer, ResearchViewerEmpty } from '@/components/research/ResearchViewer';
import { ConfirmDialog } from '@/components/brains/ConfirmDialog';
import { useBrainContext } from '@/contexts/BrainContext';
import {
  useResearch,
  useResearchTags,
  useCreateResearch,
  useUpdateResearch,
  useArchiveResearch,
  useDeleteResearch,
  MarketResearch,
  ContentType,
  DocumentStatus,
  CreateResearchRequest,
  UpdateResearchRequest,
} from '@/hooks/useResearch';

export function ResearchPage() {
  const { brainId } = useParams<{ brainId: string }>();
  const navigate = useNavigate();
  const { selectedBrain } = useBrainContext();

  // State
  const [selectedDocument, setSelectedDocument] = useState<MarketResearch | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | undefined>();
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Use brainId from URL or selected brain
  const effectiveBrainId = brainId || selectedBrain?.id;

  // Queries
  const { data, isLoading } = useResearch(effectiveBrainId, {
    content_type: contentTypeFilter,
    status: statusFilter,
    tags: selectedTags.join(',') || undefined,
    search: searchQuery || undefined,
  });
  const { data: availableTags } = useResearchTags(effectiveBrainId);

  // Mutations
  const createMutation = useCreateResearch(effectiveBrainId ?? '');
  const updateMutation = useUpdateResearch(
    effectiveBrainId ?? '',
    selectedDocument?.id ?? ''
  );
  const archiveMutation = useArchiveResearch(effectiveBrainId ?? '');
  const deleteMutation = useDeleteResearch(effectiveBrainId ?? '');

  // Handlers
  const handleSelectDocument = (doc: MarketResearch) => {
    setSelectedDocument(doc);
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    setSelectedDocument(null);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleSave = useCallback(
    async (formData: CreateResearchRequest | UpdateResearchRequest) => {
      if (isCreating) {
        const newDoc = await createMutation.mutateAsync(formData as CreateResearchRequest);
        setSelectedDocument(newDoc);
        setIsCreating(false);
      } else if (selectedDocument) {
        const updated = await updateMutation.mutateAsync(formData as UpdateResearchRequest);
        setSelectedDocument(updated);
        setIsEditing(false);
      }
    },
    [isCreating, selectedDocument, createMutation, updateMutation]
  );

  const handleArchive = useCallback(
    async (docId: string) => {
      const archived = await archiveMutation.mutateAsync(docId);
      if (selectedDocument?.id === docId) {
        setSelectedDocument(archived);
      }
    },
    [archiveMutation, selectedDocument]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    await deleteMutation.mutateAsync(deleteConfirmId);
    if (selectedDocument?.id === deleteConfirmId) {
      setSelectedDocument(null);
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteMutation, selectedDocument]);

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
        <p className="text-muted-foreground">Please select a brain to manage research</p>
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
            <h1 className="text-xl font-semibold">Market Research</h1>
            <p className="text-sm text-muted-foreground">
              {selectedBrain?.name || brainId}
            </p>
          </div>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Document list */}
        <div className="w-96 border-r border-border">
          <ResearchList
            documents={data?.documents ?? []}
            isLoading={isLoading}
            selectedDocId={selectedDocument?.id}
            onSelectDocument={handleSelectDocument}
            onArchive={handleArchive}
            onDelete={(id) => setDeleteConfirmId(id)}
            onCreateNew={handleCreateNew}
            contentTypeFilter={contentTypeFilter}
            onContentTypeFilterChange={setContentTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            availableTags={availableTags ?? []}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
          />
        </div>

        {/* Right panel - Viewer or Editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {isCreating || isEditing ? (
            <ResearchEditor
              document={isEditing ? selectedDocument ?? undefined : undefined}
              isCreating={isCreating}
              isSaving={createMutation.isPending || updateMutation.isPending}
              onSave={handleSave}
              onCancel={handleCancel}
              availableTags={availableTags ?? []}
            />
          ) : selectedDocument ? (
            <Tabs defaultValue="view" className="flex flex-1 flex-col">
              <div className="border-b border-border px-4">
                <TabsList className="h-12">
                  <TabsTrigger value="view">View</TabsTrigger>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="view" className="flex-1 overflow-hidden m-0">
                <ResearchViewer
                  document={selectedDocument}
                  onEdit={handleEdit}
                  onArchive={
                    selectedDocument.status !== 'archived'
                      ? () => handleArchive(selectedDocument.id)
                      : undefined
                  }
                  onDelete={() => setDeleteConfirmId(selectedDocument.id)}
                />
              </TabsContent>
              <TabsContent value="edit" className="flex-1 overflow-hidden m-0">
                <ResearchEditor
                  document={selectedDocument}
                  isSaving={updateMutation.isPending}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  availableTags={availableTags ?? []}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <ResearchViewerEmpty />
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="Delete Research Document"
          description="Are you sure you want to delete this research document? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  );
}

export default ResearchPage;
