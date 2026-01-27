/**
 * TemplatePreview component
 * Shows a live preview of a template with sample data
 */
import { Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TemplatePreviewProps {
  preview: string | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function TemplatePreview({
  preview,
  isLoading,
  onRefresh,
  className,
}: TemplatePreviewProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4" />
          Preview
        </CardTitle>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : preview ? (
          <div className="rounded-lg bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {preview}
            </pre>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Enter template text to see preview
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline preview for compact display
 */
export function TemplatePreviewInline({
  preview,
  isLoading,
}: {
  preview: string | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (!preview) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No preview available
      </p>
    );
  }

  return (
    <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-sans text-sm leading-relaxed">
      {preview}
    </pre>
  );
}
