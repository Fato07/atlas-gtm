/**
 * BrainCard component
 * Displays a single brain with status, stats, and actions
 */
import { MoreHorizontal, Play, Archive, Copy, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Brain,
  getBrainStatusColor,
  getBrainStatusText,
} from '@/hooks/useBrains';
import { cn } from '@/lib/utils';

interface BrainCardProps {
  brain: Brain;
  onActivate?: (brainId: string) => void;
  onArchive?: (brainId: string) => void;
  onClone?: (brainId: string) => void;
  onEdit?: (brainId: string) => void;
  onClick?: (brainId: string) => void;
}

export function BrainCard({
  brain,
  onActivate,
  onArchive,
  onClone,
  onEdit,
  onClick,
}: BrainCardProps) {
  const canActivate = brain.status === 'draft' || brain.status === 'archived';
  const canArchive = brain.status === 'active' || brain.status === 'draft';

  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
        brain.status === 'active' && 'border-green-500/50'
      )}
      onClick={() => onClick?.(brain.brain_id)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{brain.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{brain.vertical}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              getBrainStatusColor(brain.status)
            )}
          >
            {getBrainStatusText(brain.status)}
          </span>
          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Brain actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(brain.brain_id);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onClone && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(brain.brain_id);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </DropdownMenuItem>
              )}
              {(onActivate || onArchive) && <DropdownMenuSeparator />}
              {onActivate && canActivate && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onActivate(brain.brain_id);
                  }}
                  className="text-green-600 dark:text-green-400"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              {onArchive && canArchive && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(brain.brain_id);
                  }}
                  className="text-yellow-600 dark:text-yellow-400"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ICP Rules</span>
              <span className="font-medium">{brain.stats.icp_rules_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Templates</span>
              <span className="font-medium">{brain.stats.templates_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Handlers</span>
              <span className="font-medium">{brain.stats.handlers_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Docs</span>
              <span className="font-medium">{brain.stats.research_docs_count}</span>
            </div>
          </div>

          {/* Target roles (if any) */}
          {brain.config.target_roles.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground">Target Roles</p>
              <p className="mt-0.5 text-sm">
                {brain.config.target_roles.slice(0, 3).join(', ')}
                {brain.config.target_roles.length > 3 && (
                  <span className="text-muted-foreground">
                    {' '}+{brain.config.target_roles.length - 3} more
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Updated timestamp */}
          <p className="text-xs text-muted-foreground">
            Updated{' '}
            {new Date(brain.updated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for BrainCard
 */
export function BrainCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-6 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
