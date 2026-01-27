import { LucideIcon, Inbox, Activity, FileText, Brain } from 'lucide-react';

interface EmptyStateProps {
  /** Main message to display */
  title: string;
  /** Optional description text */
  description?: string;
  /** Icon type to display */
  icon?: 'inbox' | 'activity' | 'document' | 'brain' | LucideIcon;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional className for customization */
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  inbox: Inbox,
  activity: Activity,
  document: FileText,
  brain: Brain,
};

/**
 * EmptyState component for displaying when no data is available
 * Used across activity feed, lists, and other data views
 */
export function EmptyState({
  title,
  description,
  icon = 'inbox',
  action,
  className = '',
}: EmptyStateProps) {
  const IconComponent = typeof icon === 'string' ? iconMap[icon] || Inbox : icon;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
      role="status"
      aria-label={title}
    >
      <div className="mb-4 rounded-full bg-muted p-4">
        <IconComponent
          className="h-8 w-8 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common use cases
 */
export function NoActivityEmpty() {
  return (
    <EmptyState
      icon="activity"
      title="No activity today"
      description="Agent events will appear here as they occur. Check back later or trigger a manual action."
    />
  );
}

export function NoBrainsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="brain"
      title="No brains yet"
      description="Create your first brain to start managing ICP rules, templates, and research."
      action={{
        label: 'Create Brain',
        onClick: onCreate,
      }}
    />
  );
}

export function NoRulesEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="document"
      title="No ICP rules"
      description="Add scoring rules to define your ideal customer profile."
      action={{
        label: 'Add Rule',
        onClick: onCreate,
      }}
    />
  );
}

export function NoTemplatesEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon="document"
      title="No templates"
      description="Create response templates for common reply scenarios."
      action={{
        label: 'Create Template',
        onClick: onCreate,
      }}
    />
  );
}

export function NoSearchResultsEmpty() {
  return (
    <EmptyState
      icon="inbox"
      title="No results found"
      description="Try adjusting your search or filters."
    />
  );
}
