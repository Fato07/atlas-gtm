/**
 * BrainDetail page
 * Detailed view of a single brain with tabs for different content types
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MoreHorizontal,
  Play,
  Archive,
  Copy,
  Edit2,
  Loader2,
  AlertCircle,
  FileText,
  MessageSquare,
  Target,
  BookOpen,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrainFormDialog } from '@/components/brains/BrainFormDialog';
import { ConfirmDialog } from '@/components/brains/ConfirmDialog';
import { ICPRulesPreview } from '@/components/icp-rules/ICPRulesPreview';
import { TemplatesPreview } from '@/components/templates/TemplatesPreview';
import { HandlersPreview } from '@/components/handlers/HandlersPreview';
import { ResearchPreview } from '@/components/research/ResearchPreview';
import {
  useBrain,
  useActivateBrain,
  useArchiveBrain,
  useCloneBrain,
  getBrainStatusColor,
  getBrainStatusText,
} from '@/hooks/useBrains';
import { cn } from '@/lib/utils';

export function BrainDetail() {
  const { brainId } = useParams<{ brainId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    'activate' | 'archive' | null
  >(null);

  const { data: brain, isLoading, isError, error } = useBrain(brainId);
  const activateMutation = useActivateBrain();
  const archiveMutation = useArchiveBrain();
  const cloneMutation = useCloneBrain();

  const handleActivate = async () => {
    if (!brainId) return;
    try {
      await activateMutation.mutateAsync(brainId);
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to activate brain:', error);
    }
  };

  const handleArchive = async () => {
    if (!brainId) return;
    try {
      await archiveMutation.mutateAsync(brainId);
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to archive brain:', error);
    }
  };

  const handleClone = async (newName: string) => {
    if (!brainId) return;
    try {
      const result = await cloneMutation.mutateAsync({ brainId, newName });
      setCloneOpen(false);
      // Navigate to the cloned brain
      navigate(`/brains/${result.brain.brain_id}`);
    } catch (error) {
      console.error('Failed to clone brain:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (isError || !brain) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/brains')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brains
        </Button>
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-12 text-center dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Brain not found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'The brain could not be loaded.'}
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

  const canActivate = brain.status === 'draft' || brain.status === 'archived';
  const canArchive = brain.status === 'active' || brain.status === 'draft';

  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/brains')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {brain.name}
              </h1>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  getBrainStatusColor(brain.status)
                )}
              >
                {getBrainStatusText(brain.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{brain.vertical}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCloneOpen(true)}>
                <Copy className="mr-2 h-4 w-4" />
                Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canActivate && (
                <DropdownMenuItem
                  onClick={() => setConfirmAction('activate')}
                  className="text-green-600 dark:text-green-400"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              {canArchive && (
                <DropdownMenuItem
                  onClick={() => setConfirmAction('archive')}
                  className="text-yellow-600 dark:text-yellow-400"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="ICP Rules"
          value={brain.stats.icp_rules_count}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Templates"
          value={brain.stats.templates_count}
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Handlers"
          value={brain.stats.handlers_count}
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Research Docs"
          value={brain.stats.research_docs_count}
        />
        <StatCard
          icon={<Lightbulb className="h-5 w-5" />}
          label="Insights"
          value={brain.stats.insights_count}
        />
      </div>

      {/* Configuration details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Target Roles
            </p>
            <p className="mt-1 text-sm">
              {brain.config.target_roles.length > 0
                ? brain.config.target_roles.join(', ')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Company Sizes
            </p>
            <p className="mt-1 text-sm">
              {brain.config.target_company_sizes.length > 0
                ? brain.config.target_company_sizes.join(', ')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Geographic Focus
            </p>
            <p className="mt-1 text-sm">
              {brain.config.geo_focus.length > 0
                ? brain.config.geo_focus.join(', ')
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content tabs - placeholder for future implementation */}
      <Tabs defaultValue="icp-rules">
        <TabsList>
          <TabsTrigger value="icp-rules">
            ICP Rules ({brain.stats.icp_rules_count})
          </TabsTrigger>
          <TabsTrigger value="templates">
            Templates ({brain.stats.templates_count})
          </TabsTrigger>
          <TabsTrigger value="handlers">
            Handlers ({brain.stats.handlers_count})
          </TabsTrigger>
          <TabsTrigger value="research">
            Research ({brain.stats.research_docs_count})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="icp-rules" className="mt-4">
          <ICPRulesPreview brainId={brainId!} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesPreview brainId={brainId!} />
        </TabsContent>
        <TabsContent value="handlers" className="mt-4">
          <HandlersPreview brainId={brainId!} />
        </TabsContent>
        <TabsContent value="research" className="mt-4">
          <ResearchPreview brainId={brainId!} />
        </TabsContent>
      </Tabs>

      {/* Timestamps */}
      <div className="flex gap-6 text-xs text-muted-foreground">
        <p>
          Created:{' '}
          {new Date(brain.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <p>
          Last updated:{' '}
          {new Date(brain.updated_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Edit dialog */}
      {editOpen && (
        <BrainFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          brain={brain}
        />
      )}

      {/* Clone dialog */}
      {cloneOpen && (
        <BrainFormDialog
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          mode="clone"
          brain={brain}
          onClone={handleClone}
        />
      )}

      {/* Confirm dialogs */}
      {confirmAction === 'activate' && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title="Activate Brain"
          description={`Are you sure you want to activate "${brain.name}"? This will archive any currently active brain for the same vertical.`}
          confirmLabel="Activate"
          onConfirm={handleActivate}
          isLoading={activateMutation.isPending}
          variant="default"
        />
      )}

      {confirmAction === 'archive' && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title="Archive Brain"
          description={`Are you sure you want to archive "${brain.name}"? You can reactivate it later.`}
          confirmLabel="Archive"
          onConfirm={handleArchive}
          isLoading={archiveMutation.isPending}
          variant="warning"
        />
      )}
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

