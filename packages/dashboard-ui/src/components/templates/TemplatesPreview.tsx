/**
 * TemplatesPreview component
 * Inline preview of response templates for the BrainDetail page tabs
 */
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTemplates } from '@/hooks/useTemplates';
import { TemplateRow, TemplateRowSkeleton } from './TemplateRow';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';

interface TemplatesPreviewProps {
  brainId: string;
}

const PREVIEW_LIMIT = 5;

export function TemplatesPreview({ brainId }: TemplatesPreviewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTemplates(brainId);

  const templates = data?.templates ?? [];
  const total = data?.total ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <TemplateRowSkeleton key={i} />
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
            message="Failed to load templates"
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Create email response templates with variable support"
            action={{
              label: 'Add Template',
              icon: Plus,
              onClick: () => navigate(`/brains/${brainId}/templates`),
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
      <CardContent className="p-4 space-y-2">
        {templates.slice(0, PREVIEW_LIMIT).map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            onClick={() => navigate(`/brains/${brainId}/templates`)}
          />
        ))}
        {total > PREVIEW_LIMIT && (
          <p className="pt-2 text-sm text-muted-foreground text-center">
            +{total - PREVIEW_LIMIT} more templates
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/brains/${brainId}/templates`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage All Templates ({total})
        </Button>
      </CardFooter>
    </Card>
  );
}
