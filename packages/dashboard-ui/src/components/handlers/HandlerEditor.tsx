/**
 * HandlerEditor component
 * Form for creating/editing objection handlers
 */
import { useState, useEffect, useRef } from 'react';
import { Loader2, Trash2, Variable, Plus, X, Target, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import {
  ObjectionHandler,
  ObjectionType,
  CreateHandlerRequest,
  UpdateHandlerRequest,
  OBJECTION_TYPES,
  STANDARD_HANDLER_VARIABLES,
  getObjectionTypeDisplayName,
  extractVariables,
  formatUsageStats,
} from '@/hooks/useHandlers';

interface HandlerEditorProps {
  handler?: ObjectionHandler;
  isCreating?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  onSave: (data: CreateHandlerRequest | UpdateHandlerRequest) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function HandlerEditor({
  handler,
  isCreating,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onCancel,
}: HandlerEditorProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const responseRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [objectionType, setObjectionType] = useState<ObjectionType>(
    handler?.objection_type ?? 'budget'
  );
  const [triggers, setTriggers] = useState<string[]>(handler?.triggers ?? []);
  const [newTrigger, setNewTrigger] = useState('');
  const [handlerStrategy, setHandlerStrategy] = useState(handler?.handler_strategy ?? '');
  const [response, setResponse] = useState(handler?.response ?? '');
  const [followUps, setFollowUps] = useState<string[]>(handler?.follow_ups ?? []);
  const [newFollowUp, setNewFollowUp] = useState('');

  // Variable autocomplete state
  const [showVariableSuggestions, setShowVariableSuggestions] = useState(false);
  const [variableFilter, setVariableFilter] = useState('');

  // Derived state
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  // Reset form when handler changes
  useEffect(() => {
    if (handler) {
      setObjectionType(handler.objection_type);
      setTriggers(handler.triggers);
      setHandlerStrategy(handler.handler_strategy);
      setResponse(handler.response);
      setFollowUps(handler.follow_ups);
      setDetectedVariables(handler.variables);
    } else if (isCreating) {
      setObjectionType('budget');
      setTriggers([]);
      setHandlerStrategy('');
      setResponse('');
      setFollowUps([]);
      setDetectedVariables([]);
    }
  }, [handler, isCreating]);

  // Update detected variables when response changes
  useEffect(() => {
    setDetectedVariables(extractVariables(response));
  }, [response]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data: CreateHandlerRequest = {
      objection_type: objectionType,
      triggers,
      handler_strategy: handlerStrategy,
      response,
      variables: detectedVariables,
      follow_ups: followUps,
    };

    onSave(data);
  };

  const addTrigger = () => {
    if (newTrigger.trim() && !triggers.includes(newTrigger.trim())) {
      setTriggers([...triggers, newTrigger.trim()]);
      setNewTrigger('');
    }
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const addFollowUp = () => {
    if (newFollowUp.trim() && !followUps.includes(newFollowUp.trim())) {
      setFollowUps([...followUps, newFollowUp.trim()]);
      setNewFollowUp('');
    }
  };

  const removeFollowUp = (index: number) => {
    setFollowUps(followUps.filter((_, i) => i !== index));
  };

  const insertVariable = (variable: string) => {
    if (!responseRef.current) return;

    const textarea = responseRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = response;

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

    setResponse(newText);
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
      const beforeCursor = response.substring(0, textarea.selectionStart);
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

  const handleResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setResponse(newText);

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

  const isValid = triggers.length > 0 && handlerStrategy.trim() !== '' && response.trim() !== '';

  // Filter variables for autocomplete
  const filteredVariables = STANDARD_HANDLER_VARIABLES.filter((v) =>
    v.toLowerCase().includes(variableFilter.toLowerCase())
  );

  // Format stats if available
  const stats = handler?.usage_stats ? formatUsageStats(handler.usage_stats) : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <Card className="flex-1 overflow-y-auto">
          <CardHeader>
            <CardTitle>{isCreating ? 'Create New Handler' : 'Edit Handler'}</CardTitle>
            <CardDescription>
              {isCreating
                ? 'Create an objection handler with triggers and response'
                : `Editing handler for ${getObjectionTypeDisplayName(handler?.objection_type ?? 'other')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats display (for existing handlers) */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span className="text-xs">Matched</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">{stats.matchedText}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs">Used</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">{stats.usedText}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Success</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-green-600">
                    {stats.successRateText}
                  </p>
                </div>
              </div>
            )}

            {/* Objection Type */}
            <div className="space-y-2">
              <Label htmlFor="objectionType">Objection Type</Label>
              <Select
                value={objectionType}
                onValueChange={(v) => setObjectionType(v as ObjectionType)}
              >
                <SelectTrigger id="objectionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getObjectionTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Triggers */}
            <div className="space-y-2">
              <Label>Triggers</Label>
              <p className="text-xs text-muted-foreground">
                Keywords or phrases that indicate this objection
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 'too expensive'"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTrigger();
                    }
                  }}
                />
                <Button type="button" size="icon" onClick={addTrigger}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {triggers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {triggers.map((trigger, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      &quot;{trigger}&quot;
                      <button
                        type="button"
                        onClick={() => removeTrigger(i)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {triggers.length === 0 && (
                <p className="text-xs text-destructive">At least one trigger is required</p>
              )}
            </div>

            {/* Handler Strategy */}
            <div className="space-y-2">
              <Label htmlFor="strategy">Handler Strategy</Label>
              <Textarea
                id="strategy"
                placeholder="Describe the approach for handling this objection..."
                value={handlerStrategy}
                onChange={(e) => setHandlerStrategy(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Internal guidance on how to approach this objection
              </p>
            </div>

            {/* Response with Variable Autocomplete */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="response">Response Template</Label>
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
                        {STANDARD_HANDLER_VARIABLES.map((variable) => (
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
                  ref={responseRef}
                  id="response"
                  placeholder="Hi {{first_name}},&#10;&#10;I understand budget is a concern..."
                  value={response}
                  onChange={handleResponseChange}
                  onKeyDown={handleKeyDown}
                  rows={10}
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
                        STANDARD_HANDLER_VARIABLES.includes(
                          variable as typeof STANDARD_HANDLER_VARIABLES[number]
                        )
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {`{{${variable}}}`}
                      {!STANDARD_HANDLER_VARIABLES.includes(
                        variable as typeof STANDARD_HANDLER_VARIABLES[number]
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

            {/* Follow-ups */}
            <div className="space-y-2">
              <Label>Follow-up Actions</Label>
              <p className="text-xs text-muted-foreground">
                Suggested next steps after using this handler
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 'Send ROI calculator'"
                  value={newFollowUp}
                  onChange={(e) => setNewFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addFollowUp();
                    }
                  }}
                />
                <Button type="button" size="icon" onClick={addFollowUp}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {followUps.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {followUps.map((followUp, i) => (
                    <Badge key={i} variant="outline" className="gap-1 pr-1">
                      {followUp}
                      <button
                        type="button"
                        onClick={() => removeFollowUp(i)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-border p-4">
          <div>
            {handler && onDelete && (
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
              {isCreating ? 'Create Handler' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirmation */}
      {handler && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Delete Handler"
          description={
            <>
              Are you sure you want to delete this handler for{' '}
              <strong>&quot;{getObjectionTypeDisplayName(handler.objection_type)}&quot;</strong>?
              {handler.usage_stats && handler.usage_stats.times_used > 0 && (
                <span className="mt-2 block text-sm text-muted-foreground">
                  This handler has been used {handler.usage_stats.times_used} times.
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
 * Empty state when no handler is selected
 */
export function HandlerEditorEmpty({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <Target className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No handler selected</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Select a handler from the list to edit it, or create a new one.
      </p>
      <Button className="mt-4" onClick={onCreateNew}>
        Create New Handler
      </Button>
    </div>
  );
}
