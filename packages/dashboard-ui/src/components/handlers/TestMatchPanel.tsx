/**
 * TestMatchPanel component
 * Allows testing objection text against handlers to see matches
 */
import { useState } from 'react';
import { Search, Loader2, Target, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HandlerMatch,
  ObjectionHandler,
  getObjectionTypeDisplayName,
  getObjectionTypeColor,
  formatConfidence,
  getConfidenceColor,
} from '@/hooks/useHandlers';
import { cn } from '@/lib/utils';

interface TestMatchPanelProps {
  isLoading?: boolean;
  matches: HandlerMatch[];
  onTest: (text: string) => void;
  onSelectHandler?: (handler: ObjectionHandler) => void;
}

export function TestMatchPanel({
  isLoading,
  matches,
  onTest,
  onSelectHandler,
}: TestMatchPanelProps) {
  const [objectionText, setObjectionText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectionText.trim()) {
      onTest(objectionText.trim());
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Test Objection Matching
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Enter an objection to test matching...&#10;e.g., 'The pricing is too high for our budget right now'"
            value={objectionText}
            onChange={(e) => setObjectionText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button type="submit" disabled={!objectionText.trim() || isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Matching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Find Matching Handlers
              </>
            )}
          </Button>
        </form>

        {/* Results */}
        {matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {matches.length} matching handler{matches.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-2">
              {matches.map(({ handler, confidence }) => (
                <div
                  key={handler.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border p-3 transition-colors',
                    onSelectHandler && 'cursor-pointer hover:bg-accent/50'
                  )}
                  onClick={() => onSelectHandler?.(handler)}
                >
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', getConfidenceColor(confidence))}
                  >
                    {formatConfidence(confidence)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-xs', getObjectionTypeColor(handler.objection_type))}
                      >
                        {getObjectionTypeDisplayName(handler.objection_type)}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">
                      {handler.handler_strategy}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {handler.triggers.slice(0, 2).map((trigger, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground"
                        >
                          &quot;{trigger}&quot;
                        </span>
                      ))}
                      {handler.triggers.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{handler.triggers.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                  {onSelectHandler && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state after search */}
        {matches.length === 0 && objectionText.trim() && !isLoading && (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No matching handlers found for this objection.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try different wording or create a new handler.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
