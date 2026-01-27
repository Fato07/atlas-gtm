/**
 * ICPRulesPreview component
 * Inline preview of ICP rules for the BrainDetail page tabs
 */
import { useNavigate } from 'react-router-dom';
import { Target, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useICPRules } from '@/hooks/useICPRules';
import { ICPRuleRow, ICPRuleRowSkeleton } from './ICPRuleRow';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';

interface ICPRulesPreviewProps {
  brainId: string;
}

const PREVIEW_LIMIT = 5;

export function ICPRulesPreview({ brainId }: ICPRulesPreviewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useICPRules(brainId);

  const rules = data?.rules ?? [];
  const total = data?.total ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <ICPRuleRowSkeleton key={i} />
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
            message="Failed to load ICP rules"
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <EmptyState
            icon={Target}
            title="No ICP rules yet"
            description="Define scoring criteria for ideal customer profiles"
            action={{
              label: 'Add Rule',
              icon: Plus,
              onClick: () => navigate(`/brains/${brainId}/icp-rules`),
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
        {rules.slice(0, PREVIEW_LIMIT).map((rule) => (
          <ICPRuleRow
            key={rule.id}
            rule={rule}
            onClick={() => navigate(`/brains/${brainId}/icp-rules`)}
          />
        ))}
        {total > PREVIEW_LIMIT && (
          <p className="pt-2 text-sm text-muted-foreground text-center">
            +{total - PREVIEW_LIMIT} more rules
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/brains/${brainId}/icp-rules`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Manage All Rules ({total})
        </Button>
      </CardFooter>
    </Card>
  );
}
