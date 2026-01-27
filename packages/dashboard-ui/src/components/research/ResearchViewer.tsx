/**
 * ResearchViewer component
 * Displays detailed view of a research document
 */
import {
  FileText,
  BarChart2,
  MessageSquare,
  StickyNote,
  File,
  ExternalLink,
  Edit2,
  Archive,
  Trash2,
  Clock,
  Calendar,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MarketResearch,
  ContentType,
  getContentTypeDisplayName,
  getContentTypeColor,
  formatResearchDate,
  getWordCount,
  getReadingTime,
} from '@/hooks/useResearch';
import { cn } from '@/lib/utils';

interface ResearchViewerProps {
  document: MarketResearch;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

/**
 * Get icon component for content type
 */
function ContentTypeIcon({ type, className }: { type: ContentType; className?: string }) {
  const iconClass = cn('h-5 w-5', className);

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

export function ResearchViewer({
  document,
  onEdit,
  onArchive,
  onDelete,
}: ResearchViewerProps) {
  const isArchived = document.status === 'archived';
  const wordCount = getWordCount(document.content);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn('text-xs', getContentTypeColor(document.content_type))}
              >
                <ContentTypeIcon
                  type={document.content_type}
                  className="mr-1 h-3 w-3"
                />
                {getContentTypeDisplayName(document.content_type)}
              </Badge>
              {isArchived && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Archived
                </Badge>
              )}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{document.title}</h2>

            {/* Metadata */}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatResearchDate(document.created_at)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {getReadingTime(document.content)}
              </div>
              <span>{wordCount.toLocaleString()} words</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {!isArchived && onArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onArchive}
                className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Source info */}
        {document.source && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Source: {document.source}</span>
            {document.source_url && (
              <a
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                View
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        {document.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {document.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Key Facts */}
          {document.key_facts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4" />
                  Key Facts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {document.key_facts.map((fact, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Content */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Content
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {/* Render content with basic markdown-like formatting */}
              {document.content.split('\n').map((line, index) => {
                // Headers
                if (line.startsWith('### ')) {
                  return (
                    <h4 key={index} className="mt-4 mb-2 text-base font-semibold">
                      {line.slice(4)}
                    </h4>
                  );
                }
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={index} className="mt-5 mb-2 text-lg font-semibold">
                      {line.slice(3)}
                    </h3>
                  );
                }
                if (line.startsWith('# ')) {
                  return (
                    <h2 key={index} className="mt-6 mb-3 text-xl font-bold">
                      {line.slice(2)}
                    </h2>
                  );
                }

                // Bullet points
                if (line.match(/^[-•*]\s/)) {
                  return (
                    <div key={index} className="flex items-start gap-2 ml-4">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
                      <p className="text-sm">{line.slice(2)}</p>
                    </div>
                  );
                }

                // Numbered items
                if (line.match(/^\d+[.)]\s/)) {
                  return (
                    <div key={index} className="flex items-start gap-2 ml-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        {line.match(/^\d+/)?.[0]}.
                      </span>
                      <p className="text-sm">{line.replace(/^\d+[.)]\s/, '')}</p>
                    </div>
                  );
                }

                // Empty lines
                if (!line.trim()) {
                  return <div key={index} className="h-3" />;
                }

                // Regular paragraph
                return (
                  <p key={index} className="text-sm leading-relaxed">
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Empty state when no document is selected
 */
export function ResearchViewerEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <FileText className="h-12 w-12 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium text-foreground">
        No document selected
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a research document from the list to view its contents
      </p>
    </div>
  );
}
