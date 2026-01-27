/**
 * SessionExpiredNotification component
 * Subtle notification bar when session/auth expires
 */
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function SessionExpiredNotification() {
  const { sessionExpired, isChecking, dismissExpiredNotification, retryAuth } = useAuth();

  if (!sessionExpired) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-bottom-5 fade-in duration-300'
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">Session expired</p>
        <p className="text-xs text-muted-foreground">
          Your authentication has expired or is invalid. Please verify your credentials and try
          again.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={retryAuth}
            disabled={isChecking}
            className="h-7 text-xs"
          >
            {isChecking ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </>
            )}
          </Button>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0"
        onClick={dismissExpiredNotification}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
