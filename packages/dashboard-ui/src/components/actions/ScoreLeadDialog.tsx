/**
 * ScoreLeadDialog component
 * Dialog for manually triggering lead scoring
 */
import { useState, useCallback } from 'react';
import { Target, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBrainContext } from '@/contexts/BrainContext';
import { useActions } from '@/hooks/useActions';

interface ScoreLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ScoreLeadDialog - Manual lead scoring trigger
 */
export function ScoreLeadDialog({ open, onOpenChange }: ScoreLeadDialogProps) {
  const { selectedBrain } = useBrainContext();
  const { scoreLead } = useActions();

  const [email, setEmail] = useState('');
  const [forceRescore, setForceRescore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSubmitValues, setLastSubmitValues] = useState<{
    email: string;
    brain_id: string;
    force_rescore: boolean;
  } | null>(null);

  const executeScoring = useCallback(
    async (values: { email: string; brain_id: string; force_rescore: boolean }) => {
      setError(null);
      setSuccess(null);

      try {
        const result = await scoreLead.mutateAsync(values);

        setSuccess(result.message || 'Lead scoring triggered successfully');
        setEmail('');
        setForceRescore(false);
        setLastSubmitValues(null);

        // Auto-close after success
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(null);
        }, 2000);
      } catch (err) {
        setLastSubmitValues(values);
        setError(err instanceof Error ? err.message : 'Failed to trigger lead scoring');
      }
    },
    [scoreLead, onOpenChange]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBrain) {
      setError('Please select a brain first');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    await executeScoring({
      email: email.trim(),
      brain_id: selectedBrain.id,
      force_rescore: forceRescore,
    });
  };

  const handleRetry = () => {
    if (lastSubmitValues) {
      executeScoring(lastSubmitValues);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEmail('');
      setError(null);
      setSuccess(null);
      setForceRescore(false);
      setLastSubmitValues(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Score Lead
          </DialogTitle>
          <DialogDescription>
            Manually trigger lead scoring for a specific email address.
            {selectedBrain && (
              <span className="mt-1 block text-xs">
                Using brain: <strong>{selectedBrain.name}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error/Success alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                {lastSubmitValues && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={scoreLead.isPending}
                    className="ml-2 h-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-success/20 bg-success/10">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">{success}</AlertDescription>
            </Alert>
          )}

          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="score-email">Lead Email</Label>
            <Input
              id="score-email"
              type="email"
              placeholder="lead@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={scoreLead.isPending}
              autoFocus
            />
          </div>

          {/* Force rescore toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="force-rescore" className="text-sm font-medium">
                Force Rescore
              </Label>
              <p className="text-xs text-muted-foreground">
                Score even if this lead was recently processed
              </p>
            </div>
            <Switch
              id="force-rescore"
              checked={forceRescore}
              onCheckedChange={setForceRescore}
              disabled={scoreLead.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={scoreLead.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={scoreLead.isPending || !selectedBrain}>
              {scoreLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scoring...
                </>
              ) : (
                'Score Lead'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ScoreLeadDialog;
