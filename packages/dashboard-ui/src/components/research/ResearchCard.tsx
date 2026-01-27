/**
 * ResearchCard component
 * Displays a research document in a card format for lists
 */
import {
  FileText,
  BarChart2,
  MessageSquare,
  StickyNote,
  File,
  ExternalLink,
  MoreHorizontal,
  Archive,
  Trash2,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MarketResearch,
  ContentType,
  getContentTypeDisplayName,
  getContentTypeColor,
  formatResearchDate,
  getReadingTime,
} from '@/hooks/useResearch';
import { cn } from '@/lib/utils';

interface ResearchCardProps {
  document: MarketResearch;
  isSelected?: boolean;
  onSelect?: (doc: MarketResearch) => void;
  onArchive?: (docId: string) => void;
  onDelete?: (docId: string) => void;
}

/**
 * Get icon component for content type
 */
function ContentTypeIcon({ type, className }: { type: ContentType; className?: string }) {
  const iconClass = cn('h-4 w-4', className);

  switch (type) {
    case 'article':
      return <FileText className={iconClass} />;
    case 'report':
      return <BarChart2 className={iconClass} />;
    case 'transcript':
      return <MessageSquare className={iconClass} />;
    case 'notes':
      return <StickyNote className={iconClass} />;
    default:
      return <File className={iconClass} />;
  }
}

export function ResearchCard({
  document,
  isSelected,
  onSelect,
  onArchive,
  onDelete,
}: ResearchCardProps) {
  const isArchived = document.status === 'archived';

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        isArchived && 'opacity-60'
      )}
      onClick={() => onSelect?.(document)}
    >
      <CardContent className="p-4">
        {/* Header with type badge and actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn('text-xs', getContentTypeColor(document.content_type))}
            >
              <ContentTypeIcon type={document.content_type} className="mr-1 h-3 w-3" />
              {getContentTypeDisplayName(document.content_type)}
            </Badge>
            {isArchived && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Archived
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {document.source_url && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(document.source_url!, '_blank');
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Source
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isArchived && onArchive && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(document.id);
                  }}
                  className="text-yellow-600 dark:text-yellow-400"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(document.id);
                  }}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title */}
        <h3 className="mt-2 line-clamp-2 font-medium text-foreground">
          {document.title}
        </h3>

        {/* Key facts preview */}
        {document.key_facts.length > 0 && (
          <div className="mt-2 space-y-1">
            {document.key_facts.slice(0, 2).map((fact, i) => (
              <p key={i} className="line-clamp-1 text-xs text-muted-foreground">
                &bull; {fact}
              </p>
            ))}
            {document.key_facts.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{document.key_facts.length - 2} more facts
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        {document.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {document.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs font-normal"
              >
                {tag}
              </Badge>
            ))}
            {document.tags.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                +{document.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer with metadata */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getReadingTime(document.content)}
          </div>
          <span>{formatResearchDate(document.created_at)}</span>
        </div>

        {/* Source indicator */}
        {document.source && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">Source: {document.source}</span>
            {document.source_url && (
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for ResearchCard
 */
export function ResearchCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        {/* Header with badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
        {/* Title */}
        <div className="mt-2 h-5 w-full rounded bg-muted" />
        <div className="mt-1 h-5 w-3/4 rounded bg-muted" />
        {/* Key facts */}
        <div className="mt-2 space-y-1">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
        </div>
        {/* Tags */}
        <div className="mt-3 flex gap-1">
          <div className="h-5 w-14 rounded bg-muted" />
          <div className="h-5 w-16 rounded bg-muted" />
          <div className="h-5 w-12 rounded bg-muted" />
        </div>
        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
