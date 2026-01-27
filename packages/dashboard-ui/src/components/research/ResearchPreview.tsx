/**
 * ResearchPreview component
 * Inline preview of market research documents for the BrainDetail page tabs
 */
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useResearch } from '@/hooks/useResearch';
import { ResearchCard, ResearchCardSkeleton } from './ResearchCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';

interface ResearchPreviewProps {
  brainId: string;
}

const PREVIEW_LIMIT = 4; // 2x2 grid for cards

export function ResearchPreview({ brainId }: ResearchPreviewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useResearch(brainId);

  const documents = data?.documents ?? [];
  const total = data?.total ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ResearchCardSkeleton key={i} />
            ))}
          </div>
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
            message="Failed to load research documents"
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            icon={BookOpen}
            title="No research documents yet"
            description="Add market research, competitor analysis, and customer interviews"
            action={{
              label: 'Add Research',
              icon: Plus,
              onClick: () => navigate(`/brains/${brainId}/research`),
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
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {documents.slice(0, PREVIEW_LIMIT).map((doc) => (
            <ResearchCard
              key={doc.id}
              document={doc}
              onSelect={() => navigate(`/brains/${brainId}/research`)}
            />
          ))}
        </div>
        {total > PREVIEW_LIMIT && (
          <p className="mt-3 text-sm text-muted-foreground text-center">
            +{total - PREVIEW_LIMIT} more documents
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/brains/${brainId}/research`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage All Research ({total})
        </Button>
      </CardFooter>
    </Card>
  );
}
