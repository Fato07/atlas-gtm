/**
 * ConflictResolutionDialog component
 * Dialog for resolving concurrent edit conflicts on templates
 */
import { AlertTriangle, GitMerge, Upload, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ConflictState,
  ConflictResolution,
  ResponseTemplate,
} from '@/hooks/useTemplates';

interface ConflictResolutionDialogProps {
  conflictState: ConflictState;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function VersionPreview({
  label,
  template,
  variant,
}: {
  label: string;
  template: ResponseTemplate;
  variant: 'local' | 'server';
}) {
  return (
    <div
      className={`flex-1 rounded-lg border p-3 ${
        variant === 'local'
          ? 'border-blue-500/30 bg-blue-500/5'
          : 'border-orange-500/30 bg-orange-500/5'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {variant === 'local' ? (
          <Upload className="h-4 w-4 text-blue-500" />
        ) : (
          <Download className="h-4 w-4 text-orange-500" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Updated: {formatDate(template.updated_at)}
      </p>
      <ScrollArea className="mt-2 h-24 rounded border bg-muted/50 p-2">
        <pre className="whitespace-pre-wrap text-xs">{template.template_text}</pre>
      </ScrollArea>
    </div>
  );
}

export function ConflictResolutionDialog({
  conflictState,
  onResolve,
  onCancel,
}: ConflictResolutionDialogProps) {
  const { hasConflict, localVersion, serverVersion } = conflictState;

  if (!hasConflict || !localVersion || !serverVersion) {
    return null;
  }

  return (
    <Dialog open={hasConflict} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Edit Conflict Detected
          </DialogTitle>
          <DialogDescription>
            This template was modified while you were editing. Choose how to resolve the conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Version comparison */}
          <div className="flex gap-4">
            <VersionPreview label="Your Version" template={localVersion} variant="local" />
            <VersionPreview label="Server Version" template={serverVersion} variant="server" />
          </div>

          {/* Resolution options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Resolution Options:</p>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-auto justify-start p-3"
                onClick={() => onResolve('keep-local')}
              >
                <div className="flex items-start gap-3">
                  <Upload className="mt-0.5 h-4 w-4 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium">Keep My Changes</p>
                    <p className="text-xs text-muted-foreground">
                      Overwrite the server version with your local changes
                    </p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start p-3"
                onClick={() => onResolve('use-server')}
              >
                <div className="flex items-start gap-3">
                  <Download className="mt-0.5 h-4 w-4 text-orange-500" />
                  <div className="text-left">
                    <p className="font-medium">Use Server Version</p>
                    <p className="text-xs text-muted-foreground">
                      Discard your local changes and use the server version
                    </p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start p-3"
                onClick={() => onResolve('merge')}
              >
                <div className="flex items-start gap-3">
                  <GitMerge className="mt-0.5 h-4 w-4 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">Merge Changes</p>
                    <p className="text-xs text-muted-foreground">
                      Combine your text changes with server metadata updates
                    </p>
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
