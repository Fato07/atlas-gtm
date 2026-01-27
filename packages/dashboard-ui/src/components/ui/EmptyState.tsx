/**
 * EmptyState component
 * Reusable empty state display with icon, title, description, and optional action
 */
import { type LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon to display (defaults to Inbox) */
  icon?: LucideIcon;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      iconWrapper: 'p-2',
      icon: 'h-5 w-5',
      title: 'text-sm',
      description: 'text-xs',
      button: 'h-8 text-xs',
    },
    md: {
      container: 'py-12',
      iconWrapper: 'p-3',
      icon: 'h-6 w-6',
      title: 'text-sm font-medium',
      description: 'text-sm',
      button: 'h-9',
    },
    lg: {
      container: 'py-16',
      iconWrapper: 'p-4',
      icon: 'h-8 w-8',
      title: 'text-base font-medium',
      description: 'text-sm',
      button: 'h-10',
    },
  };

  const classes = sizeClasses[size];
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        classes.container,
        className
      )}
    >
      <div className={cn('rounded-full bg-muted', classes.iconWrapper)}>
        <Icon className={cn('text-muted-foreground', classes.icon)} />
      </div>
      <h3 className={cn('mt-3 text-foreground', classes.title)}>{title}</h3>
      {description && (
        <p className={cn('mt-1 max-w-[280px] text-muted-foreground', classes.description)}>
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className={cn('mt-4', classes.button)}
          onClick={action.onClick}
        >
          {ActionIcon && <ActionIcon className="mr-1.5 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * ErrorState component
 * Specialized empty state for error conditions with retry action
 */
interface ErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center',
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <svg
          className="h-6 w-6 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-medium text-destructive">
        Failed to load
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
