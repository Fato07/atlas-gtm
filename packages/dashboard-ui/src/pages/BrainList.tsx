/**
 * BrainList page
 * List all brains with filtering and management actions
 */
import { useState } from 'react';
import { Plus, RefreshCw, Filter, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrainCard, BrainCardSkeleton } from '@/components/brains/BrainCard';
import { BrainFormDialog } from '@/components/brains/BrainFormDialog';
import { ConfirmDialog } from '@/components/brains/ConfirmDialog';
import {
  useBrains,
  useActivateBrain,
  useArchiveBrain,
  useCloneBrain,
  BrainStatus,
  Brain,
} from '@/hooks/useBrains';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type TabValue = 'all' | 'active' | 'draft' | 'archived';

export function BrainList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editBrain, setEditBrain] = useState<Brain | null>(null);
  const [cloneBrain, setCloneBrain] = useState<Brain | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'archive';
    brain: Brain;
  } | null>(null);

  // Determine status filter
  const statusFilter: BrainStatus | undefined =
    activeTab === 'all' ? undefined : (activeTab as BrainStatus);

  const {
    data: brains,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBrains(statusFilter ? { status: statusFilter } : undefined);

  const activateMutation = useActivateBrain();
  const archiveMutation = useArchiveBrain();
  const cloneMutation = useCloneBrain();

  // Handle actions
  const handleActivate = async () => {
    if (!confirmAction || confirmAction.type !== 'activate') return;
    try {
      await activateMutation.mutateAsync(confirmAction.brain.brain_id);
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to activate brain:', error);
    }
  };

  const handleArchive = async () => {
    if (!confirmAction || confirmAction.type !== 'archive') return;
    try {
      await archiveMutation.mutateAsync(confirmAction.brain.brain_id);
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to archive brain:', error);
    }
  };

  const handleClone = async (newName: string) => {
    if (!cloneBrain) return;
    try {
      await cloneMutation.mutateAsync({
        brainId: cloneBrain.brain_id,
        newName,
      });
      setCloneBrain(null);
    } catch (error) {
      console.error('Failed to clone brain:', error);
    }
  };

  const handleBrainClick = (brainId: string) => {
    navigate(`/brains/${brainId}`);
  };

  // Count by status
  const counts = {
    all: brains?.length ?? 0,
    active: brains?.filter((b) => b.status === 'active').length ?? 0,
    draft: brains?.filter((b) => b.status === 'draft').length ?? 0,
    archived: brains?.filter((b) => b.status === 'archived').length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Brains</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage knowledge bases for different verticals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Brain
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({counts.archived})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BrainCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-12 text-center dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Failed to load brains
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && brains?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Filter className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            {activeTab === 'all' ? 'No brains yet' : `No ${activeTab} brains`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === 'all'
              ? 'Get started by creating your first brain.'
              : `You don't have any ${activeTab} brains.`}
          </p>
          {activeTab === 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Brain
            </Button>
          )}
        </div>
      )}

      {/* Brain grid */}
      {!isLoading && !isError && brains && brains.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brains.map((brain) => (
            <BrainCard
              key={brain.brain_id}
              brain={brain}
              onClick={handleBrainClick}
              onEdit={(id) => {
                const b = brains.find((x) => x.brain_id === id);
                if (b) setEditBrain(b);
              }}
              onClone={(id) => {
                const b = brains.find((x) => x.brain_id === id);
                if (b) setCloneBrain(b);
              }}
              onActivate={(id) => {
                const b = brains.find((x) => x.brain_id === id);
                if (b) setConfirmAction({ type: 'activate', brain: b });
              }}
              onArchive={(id) => {
                const b = brains.find((x) => x.brain_id === id);
                if (b) setConfirmAction({ type: 'archive', brain: b });
              }}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <BrainFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      {/* Edit dialog */}
      {editBrain && (
        <BrainFormDialog
          open={!!editBrain}
          onOpenChange={(open) => !open && setEditBrain(null)}
          mode="edit"
          brain={editBrain}
        />
      )}

      {/* Clone dialog */}
      {cloneBrain && (
        <BrainFormDialog
          open={!!cloneBrain}
          onOpenChange={(open) => !open && setCloneBrain(null)}
          mode="clone"
          brain={cloneBrain}
          onClone={handleClone}
        />
      )}

      {/* Confirm dialogs */}
      {confirmAction?.type === 'activate' && (() => {
        const brain = confirmAction.brain;
        const { stats } = brain;
        const totalContent =
          stats.icp_rules_count +
          stats.templates_count +
          stats.handlers_count +
          stats.research_docs_count;
        const isMinimalContent = totalContent < 3;
        const isEmpty = totalContent === 0;

        const warningMessage = isEmpty
          ? `⚠️ Warning: This brain has no content (0 ICP rules, 0 templates, 0 handlers, 0 research docs). Activating an empty brain will result in agents operating without any knowledge base guidance.`
          : isMinimalContent
            ? `⚠️ Warning: This brain has minimal content (${stats.icp_rules_count} ICP rules, ${stats.templates_count} templates, ${stats.handlers_count} handlers, ${stats.research_docs_count} research docs). Consider adding more content before activation for optimal agent performance.`
            : null;

        return (
          <ConfirmDialog
            open={true}
            onOpenChange={(open) => !open && setConfirmAction(null)}
            title="Activate Brain"
            description={
              <>
                {warningMessage && (
                  <div className="mb-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
                    {warningMessage}
                  </div>
                )}
                <span>
                  Are you sure you want to activate "{brain.name}"? This will archive any currently active brain for the same vertical.
                </span>
              </>
            }
            confirmLabel={isEmpty ? 'Activate Anyway' : 'Activate'}
            onConfirm={handleActivate}
            isLoading={activateMutation.isPending}
            variant={isEmpty ? 'warning' : 'default'}
          />
        );
      })()}

      {confirmAction?.type === 'archive' && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title="Archive Brain"
          description={`Are you sure you want to archive "${confirmAction.brain.name}"? You can reactivate it later.`}
          confirmLabel="Archive"
          onConfirm={handleArchive}
          isLoading={archiveMutation.isPending}
          variant="warning"
        />
      )}
    </div>
  );
}
