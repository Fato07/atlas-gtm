/**
 * TemplateEditor component
 * Form for creating/editing response templates with variable autocomplete
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Trash2, Variable, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/brains/ConfirmDialog';
import { TemplatePreview } from './TemplatePreview';
import {
  ResponseTemplate,
  ReplyType,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  REPLY_TYPES,
  STANDARD_TEMPLATE_VARIABLES,
  getReplyTypeDisplayName,
  extractVariables,
  formatMetrics,
} from '@/hooks/useTemplates';
// cn utility available if needed for conditional classes

interface TemplateEditorProps {
  template?: ResponseTemplate;
  brainId?: string;
  isCreating?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  onSave: (data: CreateTemplateRequest | UpdateTemplateRequest) => void;
  onDelete?: () => void;
  onCancel: () => void;
  onPreview?: (text: string) => Promise<{ preview: string; detected_variables: string[] }>;
}

export function TemplateEditor({
  template,
  isCreating,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onCancel,
  onPreview,
}: TemplateEditorProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Store onPreview in a ref to avoid callback instability
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  }, [onPreview]);

  // Form state
  const [replyType, setReplyType] = useState<ReplyType>(
    template?.reply_type ?? 'positive_interest'
  );
  const [tier, setTier] = useState<1 | 2 | 3>(template?.tier ?? 1);
  const [templateText, setTemplateText] = useState(template?.template_text ?? '');

  // Preview state
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  // Variable autocomplete state
  const [showVariableSuggestions, setShowVariableSuggestions] = useState(false);
  const [variableFilter, setVariableFilter] = useState('');

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setReplyType(template.reply_type);
      setTier(template.tier);
      setTemplateText(template.template_text);
      setDetectedVariables(template.variables);
    } else if (isCreating) {
      setReplyType('positive_interest');
      setTier(1);
      setTemplateText('');
      setDetectedVariables([]);
    }
  }, [template, isCreating]);

  // Update preview when template text changes
  // Uses ref for onPreview to avoid callback instability causing repeated API calls
  const updatePreview = useCallback(async () => {
    if (!templateText.trim()) {
      setPreview(null);
      setDetectedVariables([]);
      return;
    }

    const previewFn = onPreviewRef.current;
    if (previewFn) {
      setIsPreviewLoading(true);
      try {
        const result = await previewFn(templateText);
        setPreview(result.preview);
        setDetectedVariables(result.detected_variables);
      } catch {
        // Fallback to local extraction
        setDetectedVariables(extractVariables(templateText));
      } finally {
        setIsPreviewLoading(false);
      }
    } else {
      // Local extraction only
      setDetectedVariables(extractVariables(templateText));
    }
  }, [templateText]);

  // Debounce preview updates
  useEffect(() => {
    const timeout = setTimeout(updatePreview, 500);
    return () => clearTimeout(timeout);
  }, [updatePreview]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data: CreateTemplateRequest = {
      reply_type: replyType,
      tier,
      template_text: templateText,
      variables: detectedVariables,
    };

    onSave(data);
  };

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateText;

    const before = text.substring(0, start);
    const after = text.substring(end);

    // Check if we're completing a partial variable
    const partialMatch = before.match(/\{\{(\w*)$/);
    let newText: string;
    let newCursorPos: number;

    if (partialMatch) {
      // Replace partial variable
      const beforePartial = before.substring(0, before.length - partialMatch[0].length);
      newText = `${beforePartial}{{${variable}}}${after}`;
      newCursorPos = beforePartial.length + variable.length + 4;
    } else {
      // Insert new variable
      newText = `${before}{{${variable}}}${after}`;
      newCursorPos = start + variable.length + 4;
    }

    setTemplateText(newText);
    setShowVariableSuggestions(false);
    setVariableFilter('');

    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for {{ to trigger autocomplete
    if (e.key === '{') {
      const textarea = e.currentTarget;
      const beforeCursor = templateText.substring(0, textarea.selectionStart);
      if (beforeCursor.endsWith('{')) {
        setShowVariableSuggestions(true);
        setVariableFilter('');
      }
    }

    // Close on escape
    if (e.key === 'Escape') {
      setShowVariableSuggestions(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTemplateText(newText);

    // Check for partial variable to filter suggestions
    const beforeCursor = newText.substring(0, e.target.selectionStart);
    const partialMatch = beforeCursor.match(/\{\{(\w*)$/);
    if (partialMatch) {
      setVariableFilter(partialMatch[1]);
      setShowVariableSuggestions(true);
    } else {
      setShowVariableSuggestions(false);
    }
  };

  const isValid = templateText.trim() !== '';

  // Filter variables for autocomplete
  const filteredVariables = STANDARD_TEMPLATE_VARIABLES.filter((v) =>
    v.toLowerCase().includes(variableFilter.toLowerCase())
  );

  // Format metrics if available
  const metrics = template?.metrics ? formatMetrics(template.metrics) : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <Card className="flex-1 overflow-y-auto">
          <CardHeader>
            <CardTitle>{isCreating ? 'Create New Template' : 'Edit Template'}</CardTitle>
            <CardDescription>
              {isCreating
                ? 'Create a response template for email replies'
                : `Editing template for ${getReplyTypeDisplayName(template?.reply_type ?? 'other')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metrics display (for existing templates) */}
            {metrics && (
              <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs">Usage</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">{metrics.usageText}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Reply Rate</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-green-600">
                    {metrics.replyRateText}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Positive Rate</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-blue-600">
                    {metrics.positiveRateText}
                  </p>
                </div>
              </div>
            )}

            {/* Reply Type and Tier */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="replyType">Reply Type</Label>
                <Select
                  value={replyType}
                  onValueChange={(v) => setReplyType(v as ReplyType)}
                >
                  <SelectTrigger id="replyType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPLY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getReplyTypeDisplayName(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier">Priority Tier</Label>
                <Select
                  value={String(tier)}
                  onValueChange={(v) => setTier(Number(v) as 1 | 2 | 3)}
                >
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1 (High Priority)</SelectItem>
                    <SelectItem value="2">Tier 2 (Medium Priority)</SelectItem>
                    <SelectItem value="3">Tier 3 (Low Priority)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Template Text with Variable Autocomplete */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="templateText">Template Text</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      <Variable className="mr-1 h-4 w-4" />
                      Insert Variable
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Click to insert
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {STANDARD_TEMPLATE_VARIABLES.map((variable) => (
                          <Badge
                            key={variable}
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => insertVariable(variable)}
                          >
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  id="templateText"
                  placeholder="Hi {{first_name}},&#10;&#10;Thanks for reaching out..."
                  value={templateText}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  rows={12}
                  className="font-mono text-sm"
                />

                {/* Variable autocomplete dropdown */}
                {showVariableSuggestions && filteredVariables.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {filteredVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => insertVariable(variable)}
                      >
                        <Variable className="mr-2 h-3 w-3 text-muted-foreground" />
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Type {`{{`} to see variable suggestions. Variables will be replaced with
                lead data.
              </p>
            </div>

            {/* Detected Variables */}
            {detectedVariables.length > 0 && (
              <div className="space-y-2">
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-1">
                  {detectedVariables.map((variable) => (
                    <Badge
                      key={variable}
                      variant={
                        STANDARD_TEMPLATE_VARIABLES.includes(
                          variable as typeof STANDARD_TEMPLATE_VARIABLES[number]
                        )
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {`{{${variable}}}`}
                      {!STANDARD_TEMPLATE_VARIABLES.includes(
                        variable as typeof STANDARD_TEMPLATE_VARIABLES[number]
                      ) && (
                        <span className="ml-1 text-xs text-yellow-600">
                          (custom)
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <TemplatePreview
              preview={preview}
              isLoading={isPreviewLoading}
              onRefresh={updatePreview}
            />
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-border p-4">
          <div>
            {template && onDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirmation */}
      {template && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Delete Template"
          description={
            <>
              Are you sure you want to delete this template for{' '}
              <strong>"{getReplyTypeDisplayName(template.reply_type)}"</strong>?
              {template.metrics && template.metrics.times_used > 0 && (
                <span className="mt-2 block text-sm text-muted-foreground">
                  This template has been used {template.metrics.times_used} times.
                </span>
              )}
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => {
            onDelete?.();
            setDeleteConfirmOpen(false);
          }}
          isLoading={isDeleting}
          variant="danger"
        />
      )}
    </>
  );
}

/**
 * Empty state when no template is selected
 */
export function TemplateEditorEmpty({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <Variable className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No template selected</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Select a template from the list to edit it, or create a new one.
      </p>
      <Button className="mt-4" onClick={onCreateNew}>
        Create New Template
      </Button>
    </div>
  );
}
