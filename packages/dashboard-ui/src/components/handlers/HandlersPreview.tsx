/**
 * HandlersPreview component
 * Inline preview of objection handlers for the BrainDetail page tabs
 */
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHandlers } from '@/hooks/useHandlers';
import { HandlerRow, HandlerRowSkeleton } from './HandlerRow';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';

interface HandlersPreviewProps {
  brainId: string;
}

const PREVIEW_LIMIT = 5;

export function HandlersPreview({ brainId }: HandlersPreviewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useHandlers(brainId);

  const handlers = data?.handlers ?? [];
  const total = data?.total ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <HandlerRowSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="p-4">
          <ErrorState
            message="Failed to load handlers"
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (handlers.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            icon={MessageSquare}
            title="No handlers yet"
            description="Create handlers for common objections with triggers and response templates"
            action={{
              label: 'Add Handler',
              icon: Plus,
              onClick: () => navigate(`/brains/${brainId}/handlers`),
            }}
            size="sm"
          />
        </CardContent>
      </Card>
    );
  }

  // Content preview
  return (
    <Card>
      <CardContent className="p-0">
        {handlers.slice(0, PREVIEW_LIMIT).map((handler) => (
          <HandlerRow
            key={handler.id}
            handler={handler}
            onClick={() => navigate(`/brains/${brainId}/handlers`)}
          />
        ))}
        {total > PREVIEW_LIMIT && (
          <p className="py-3 text-sm text-muted-foreground text-center border-t">
            +{total - PREVIEW_LIMIT} more handlers
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/brains/${brainId}/handlers`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage All Handlers ({total})
        </Button>
      </CardFooter>
    </Card>
  );
}
