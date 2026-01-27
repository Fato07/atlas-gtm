/**
 * PendingCard - Displays a single pending validation item
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PendingItemWithStatus,
  PENDING_TYPE_LABELS,
  URGENCY_LABELS,
  PENDING_TYPE_ICONS,
  getUrgencyBadgeClass,
  formatTimeRemaining,
} from '@/hooks/usePending';
import { ExternalLink, Clock, Check, X } from 'lucide-react';

interface PendingCardProps {
  item: PendingItemWithStatus;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

/**
 * Loading skeleton for PendingCard
 */
export function PendingCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        {/* Header with type and urgency badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded bg-muted" />
        </div>
        {/* Title */}
        <div className="mt-2 h-5 w-full rounded bg-muted" />
        <div className="mt-1 h-5 w-3/4 rounded bg-muted" />
        {/* Description */}
        <div className="flex items-center gap-4 mt-1">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Context preview */}
        <div className="mb-3 p-2 bg-muted/50 rounded-md">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-20 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PendingCard({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: PendingCardProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = () => {
    onApprove(item.id);
  };

  const handleReject = () => {
    if (showRejectInput) {
      if (rejectReason.trim()) {
        onReject(item.id, rejectReason.trim());
        setRejectReason('');
        setShowRejectInput(false);
      }
    } else {
      setShowRejectInput(true);
    }
  };

  const handleCancelReject = () => {
    setShowRejectInput(false);
    setRejectReason('');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isDisabled = isApproving || isRejecting;

  return (
    <Card
      className={`transition-all ${
        item.is_expiring_soon ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{PENDING_TYPE_ICONS[item.type]}</span>
            <Badge variant="outline" className="font-normal">
              {PENDING_TYPE_LABELS[item.type]}
            </Badge>
          </div>
          <Badge className={getUrgencyBadgeClass(item.urgency)}>
            {URGENCY_LABELS[item.urgency]}
          </Badge>
        </div>
        <CardTitle className="text-base font-medium mt-2 line-clamp-2">
          {item.summary}
        </CardTitle>
        <CardDescription className="flex items-center gap-4 mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(item.created_at)}
          </span>
          {item.expires_at && (
            <span
              className={`flex items-center gap-1 ${
                item.is_expiring_soon ? 'text-red-600 dark:text-red-400 font-medium' : ''
              }`}
            >
              <Clock className="h-3 w-3" />
              {formatTimeRemaining(item.time_remaining_ms)} remaining
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Context preview */}
        {item.context && Object.keys(item.context).length > 0 && (
          <div className="mb-3 p-2 bg-muted rounded-md text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(item.context)
                .slice(0, 4)
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="font-medium truncate ml-2">
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Slack link */}
        {item.slack_link && (
          <a
            href={item.slack_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
          >
            <ExternalLink className="h-3 w-3" />
            View in Slack
          </a>
        )}

        {/* Reject reason input */}
        {showRejectInput && (
          <div className="mb-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="w-full p-2 border rounded-md text-sm resize-none"
              rows={2}
              autoFocus
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          {!showRejectInput ? (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isDisabled}
                className="flex items-center gap-1"
              >
                <Check className="h-4 w-4" />
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={isDisabled}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
                disabled={isDisabled || !rejectReason.trim()}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelReject}
                disabled={isDisabled}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
