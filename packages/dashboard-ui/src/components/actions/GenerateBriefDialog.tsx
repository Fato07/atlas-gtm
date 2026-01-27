/**
 * GenerateBriefDialog component
 * Dialog for manually triggering meeting brief generation
 */
import { useState, useCallback } from 'react';
import { FileText, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
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

interface GenerateBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * GenerateBriefDialog - Manual meeting brief generation trigger
 */
export function GenerateBriefDialog({ open, onOpenChange }: GenerateBriefDialogProps) {
  const { selectedBrain } = useBrainContext();
  const { generateBrief } = useActions();

  const [email, setEmail] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSubmitValues, setLastSubmitValues] = useState<{
    email: string;
    brain_id: string;
    meeting_time?: string;
    force_regenerate: boolean;
  } | null>(null);

  // Default meeting time to 30 minutes from now
  const getDefaultMeetingTime = () => {
    const date = new Date(Date.now() + 30 * 60 * 1000);
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  };

  const executeBriefGeneration = useCallback(
    async (values: {
      email: string;
      brain_id: string;
      meeting_time?: string;
      force_regenerate: boolean;
    }) => {
      setError(null);
      setSuccess(null);

      try {
        const result = await generateBrief.mutateAsync(values);

        setSuccess(result.message || 'Brief generation triggered successfully');
        setEmail('');
        setMeetingTime('');
        setForceRegenerate(false);
        setLastSubmitValues(null);

        // Auto-close after success
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(null);
        }, 2000);
      } catch (err) {
        setLastSubmitValues(values);
        setError(err instanceof Error ? err.message : 'Failed to trigger brief generation');
      }
    },
    [generateBrief, onOpenChange]
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

    await executeBriefGeneration({
      email: email.trim(),
      brain_id: selectedBrain.id,
      meeting_time: meetingTime ? new Date(meetingTime).toISOString() : undefined,
      force_regenerate: forceRegenerate,
    });
  };

  const handleRetry = () => {
    if (lastSubmitValues) {
      executeBriefGeneration(lastSubmitValues);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEmail('');
      setMeetingTime('');
      setError(null);
      setSuccess(null);
      setForceRegenerate(false);
      setLastSubmitValues(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Meeting Brief
          </DialogTitle>
          <DialogDescription>
            Manually trigger meeting brief generation for a specific lead.
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
                    disabled={generateBrief.isPending}
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
            <Label htmlFor="brief-email">Lead Email</Label>
            <Input
              id="brief-email"
              type="email"
              placeholder="lead@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={generateBrief.isPending}
              autoFocus
            />
          </div>

          {/* Meeting time input */}
          <div className="space-y-2">
            <Label htmlFor="meeting-time">Meeting Time (optional)</Label>
            <Input
              id="meeting-time"
              type="datetime-local"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              disabled={generateBrief.isPending}
              min={new Date().toISOString().slice(0, 16)}
              placeholder={getDefaultMeetingTime()}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to 30 minutes from now if not specified
            </p>
          </div>

          {/* Force regenerate toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="force-regenerate" className="text-sm font-medium">
                Force Regenerate
              </Label>
              <p className="text-xs text-muted-foreground">
                Generate even if a recent brief exists
              </p>
            </div>
            <Switch
              id="force-regenerate"
              checked={forceRegenerate}
              onCheckedChange={setForceRegenerate}
              disabled={generateBrief.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={generateBrief.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={generateBrief.isPending || !selectedBrain}>
              {generateBrief.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Brief'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default GenerateBriefDialog;
