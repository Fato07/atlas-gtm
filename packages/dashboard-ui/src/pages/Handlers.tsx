/**
 * Handlers Page
 * Split-view layout for managing objection handlers with test matching
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HandlerList } from '@/components/handlers/HandlerList';
import { HandlerEditor, HandlerEditorEmpty } from '@/components/handlers/HandlerEditor';
import { TestMatchPanel } from '@/components/handlers/TestMatchPanel';
import { useBrainContext } from '@/contexts/BrainContext';
import {
  useHandlers,
  useCreateHandler,
  useUpdateHandler,
  useDeleteHandler,
  useTestMatchHandlers,
  ObjectionHandler,
  ObjectionType,
  CreateHandlerRequest,
  UpdateHandlerRequest,
  HandlerMatch,
} from '@/hooks/useHandlers';

export function HandlersPage() {
  const { brainId } = useParams<{ brainId: string }>();
  const navigate = useNavigate();
  const { selectedBrain } = useBrainContext();

  // State
  const [selectedHandler, setSelectedHandler] = useState<ObjectionHandler | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [objectionTypeFilter, setObjectionTypeFilter] = useState<ObjectionType | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [testMatches, setTestMatches] = useState<HandlerMatch[]>([]);
  const [rightPanelTab, setRightPanelTab] = useState<'editor' | 'test'>('editor');

  // Use brainId from URL or selected brain
  const effectiveBrainId = brainId || selectedBrain?.id;

  // Queries
  const { data, isLoading } = useHandlers(effectiveBrainId, {
    objection_type: objectionTypeFilter,
  });

  // Mutations
  const createMutation = useCreateHandler(effectiveBrainId ?? '');
  const updateMutation = useUpdateHandler(
    effectiveBrainId ?? '',
    selectedHandler?.id ?? ''
  );
  const deleteMutation = useDeleteHandler(effectiveBrainId ?? '');
  const testMatchMutation = useTestMatchHandlers(effectiveBrainId ?? '');

  // Filter handlers by search
  const filteredHandlers = (data?.handlers ?? []).filter((handler) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      handler.triggers.some((t) => t.toLowerCase().includes(searchLower)) ||
      handler.response.toLowerCase().includes(searchLower) ||
      handler.handler_strategy.toLowerCase().includes(searchLower)
    );
  });

  // Handlers
  const handleSelectHandler = (handler: ObjectionHandler) => {
    setSelectedHandler(handler);
    setIsCreating(false);
    setRightPanelTab('editor');
  };

  const handleCreateNew = () => {
    setSelectedHandler(null);
    setIsCreating(true);
    setRightPanelTab('editor');
  };

  const handleCancel = () => {
    setSelectedHandler(null);
    setIsCreating(false);
  };

  const handleSave = async (formData: CreateHandlerRequest | UpdateHandlerRequest) => {
    if (isCreating) {
      const newHandler = await createMutation.mutateAsync(formData as CreateHandlerRequest);
      setSelectedHandler(newHandler);
      setIsCreating(false);
    } else if (selectedHandler) {
      const updated = await updateMutation.mutateAsync(formData as UpdateHandlerRequest);
      setSelectedHandler(updated);
    }
  };

  const handleDelete = async () => {
    if (!selectedHandler) return;
    await deleteMutation.mutateAsync(selectedHandler.id);
    setSelectedHandler(null);
  };

  const handleDeleteFromList = async (handlerId: string) => {
    await deleteMutation.mutateAsync(handlerId);
    if (selectedHandler?.id === handlerId) {
      setSelectedHandler(null);
    }
  };

  const handleTestMatch = useCallback(
    async (text: string) => {
      const matches = await testMatchMutation.mutateAsync({ objectionText: text });
      setTestMatches(matches);
    },
    [testMatchMutation]
  );

  const handleSelectFromMatch = (handler: ObjectionHandler) => {
    setSelectedHandler(handler);
    setIsCreating(false);
    setRightPanelTab('editor');
  };

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
        <p className="text-muted-foreground">Please select a brain to manage handlers</p>
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
            <h1 className="text-xl font-semibold">Objection Handlers</h1>
            <p className="text-sm text-muted-foreground">
              {selectedBrain?.name || brainId}
            </p>
          </div>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Handler list */}
        <div className="w-96 border-r border-border">
          <HandlerList
            handlers={filteredHandlers}
            isLoading={isLoading}
            selectedHandlerId={selectedHandler?.id}
            onSelectHandler={handleSelectHandler}
            onDeleteHandler={handleDeleteFromList}
            onCreateNew={handleCreateNew}
            objectionTypeFilter={objectionTypeFilter}
            onObjectionTypeFilterChange={setObjectionTypeFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right panel - Editor or Test */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs
            value={rightPanelTab}
            onValueChange={(v) => setRightPanelTab(v as 'editor' | 'test')}
            className="flex flex-1 flex-col"
          >
            <div className="border-b border-border px-4">
              <TabsList className="h-12">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="test">Test Match</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 overflow-y-auto m-0">
              {isCreating || selectedHandler ? (
                <HandlerEditor
                  handler={selectedHandler ?? undefined}
                  isCreating={isCreating}
                  isSaving={createMutation.isPending || updateMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onCancel={handleCancel}
                />
              ) : (
                <HandlerEditorEmpty onCreateNew={handleCreateNew} />
              )}
            </TabsContent>

            <TabsContent value="test" className="flex-1 overflow-y-auto m-0 p-4">
              <TestMatchPanel
                isLoading={testMatchMutation.isPending}
                matches={testMatches}
                onTest={handleTestMatch}
                onSelectHandler={handleSelectFromMatch}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default HandlersPage;
