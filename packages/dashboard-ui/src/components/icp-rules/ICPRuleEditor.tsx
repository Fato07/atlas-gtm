/**
 * ICPRuleEditor component
 * Form for creating/editing ICP rules with condition builder
 */
import { useState, useEffect } from 'react';
import { Loader2, Trash2, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import { ConfirmDialog } from '@/components/brains/ConfirmDialog';
import {
  ICPRule,
  ICPCategory,
  RuleOperator,
  RuleCondition,
  CreateICPRuleRequest,
  UpdateICPRuleRequest,
  ICP_CATEGORIES,
  RULE_OPERATORS,
  getCategoryDisplayName,
  getOperatorDisplayName,
  getWeightColor,
} from '@/hooks/useICPRules';
import { cn } from '@/lib/utils';

interface ICPRuleEditorProps {
  rule?: ICPRule;
  brainId?: string;
  isCreating?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  onSave: (data: CreateICPRuleRequest | UpdateICPRuleRequest) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function ICPRuleEditor({
  rule,
  isCreating,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onCancel,
}: ICPRuleEditorProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form state - use || to handle null values from API
  const [category, setCategory] = useState<ICPCategory>(rule?.category ?? 'firmographic');
  const [attribute, setAttribute] = useState(rule?.attribute || '');
  const [displayName, setDisplayName] = useState(rule?.display_name || '');
  const [operator, setOperator] = useState<RuleOperator>(rule?.condition?.operator ?? 'eq');
  const [conditionValue, setConditionValue] = useState<string>(
    rule?.condition?.value
      ? Array.isArray(rule.condition.value)
        ? rule.condition.value.join(', ')
        : String(rule.condition.value)
      : ''
  );
  const [caseSensitive, setCaseSensitive] = useState(rule?.condition?.case_sensitive ?? false);
  const [scoreWeight, setScoreWeight] = useState(rule?.score_weight ?? 10);
  const [isKnockout, setIsKnockout] = useState(rule?.is_knockout ?? false);
  const [reasoning, setReasoning] = useState(rule?.reasoning ?? '');

  // Reset form when rule changes
  useEffect(() => {
    if (rule) {
      setCategory(rule.category);
      setAttribute(rule.attribute || '');
      setDisplayName(rule.display_name || '');
      setOperator(rule.condition?.operator ?? 'eq');
      setConditionValue(
        rule.condition?.value
          ? Array.isArray(rule.condition.value)
            ? rule.condition.value.join(', ')
            : String(rule.condition.value)
          : ''
      );
      setCaseSensitive(rule.condition?.case_sensitive ?? false);
      setScoreWeight(rule.score_weight ?? 10);
      setIsKnockout(rule.is_knockout ?? false);
      setReasoning(rule.reasoning || '');
    } else if (isCreating) {
      // Reset to defaults for new rule
      setCategory('firmographic');
      setAttribute('');
      setDisplayName('');
      setOperator('eq');
      setConditionValue('');
      setCaseSensitive(false);
      setScoreWeight(10);
      setIsKnockout(false);
      setReasoning('');
    }
  }, [rule, isCreating]);

  const parseConditionValue = (): string | number | boolean | string[] => {
    // Handle array values for 'in' and 'not_in' operators
    if (operator === 'in' || operator === 'not_in') {
      return conditionValue.split(',').map((v) => v.trim()).filter(Boolean);
    }
    // Try to parse as number
    const num = Number(conditionValue);
    if (!isNaN(num) && conditionValue.trim() !== '') {
      return num;
    }
    // Check for boolean
    if (conditionValue.toLowerCase() === 'true') return true;
    if (conditionValue.toLowerCase() === 'false') return false;
    // Default to string
    return conditionValue;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const condition: RuleCondition = {
      operator,
      value: parseConditionValue(),
      ...(caseSensitive && { case_sensitive: true }),
    };

    const data: CreateICPRuleRequest = {
      category,
      attribute,
      display_name: displayName,
      condition,
      score_weight: scoreWeight,
      is_knockout: isKnockout,
      ...(reasoning && { reasoning }),
    };

    onSave(data);
  };

  const isValid =
    attribute.trim() !== '' &&
    displayName.trim() !== '' &&
    conditionValue.trim() !== '';

  // Show operators that make sense for the value type
  const getRelevantOperators = (): RuleOperator[] => {
    // String operators
    if (operator === 'contains' || operator === 'not_contains' || operator === 'regex') {
      return RULE_OPERATORS;
    }
    return RULE_OPERATORS;
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <Card className="flex-1 overflow-y-auto">
          <CardHeader>
            <CardTitle>{isCreating ? 'Create New Rule' : 'Edit Rule'}</CardTitle>
            <CardDescription>
              {isCreating
                ? 'Define a new ICP scoring rule'
                : `Editing: ${rule?.display_name}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ICPCategory)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICP_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryDisplayName(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attribute */}
            <div className="space-y-2">
              <Label htmlFor="attribute">Attribute Name</Label>
              <Input
                id="attribute"
                placeholder="e.g., company_size, industry, tech_stack"
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The field to evaluate (must match lead data)
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Company Size (11-200 employees)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Human-readable name shown in the dashboard
              </p>
            </div>

            {/* Condition Builder */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h4 className="text-sm font-medium">Condition</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Operator */}
                <div className="space-y-2">
                  <Label htmlFor="operator">Operator</Label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as RuleOperator)}>
                    <SelectTrigger id="operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getRelevantOperators().map((op) => (
                        <SelectItem key={op} value={op}>
                          {getOperatorDisplayName(op)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    placeholder={
                      operator === 'in' || operator === 'not_in'
                        ? 'value1, value2, value3'
                        : 'Enter value'
                    }
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Case sensitive toggle for string operators */}
              {(operator === 'contains' ||
                operator === 'not_contains' ||
                operator === 'eq' ||
                operator === 'neq') && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="caseSensitive" className="text-sm">
                    Case sensitive
                  </Label>
                  <Switch
                    id="caseSensitive"
                    checked={caseSensitive}
                    onCheckedChange={setCaseSensitive}
                  />
                </div>
              )}
            </div>

            {/* Score Weight */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Score Weight</Label>
                <span className={cn('text-lg font-bold', getWeightColor(scoreWeight))}>
                  {scoreWeight > 0 ? '+' : ''}
                  {scoreWeight}
                </span>
              </div>
              <Slider
                value={[scoreWeight]}
                onValueChange={([v]: number[]) => setScoreWeight(v)}
                min={-100}
                max={100}
                step={5}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Points added (positive) or subtracted (negative) when rule matches
              </p>
            </div>

            {/* Knockout Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-500" />
                  <Label htmlFor="knockout" className="font-medium">
                    Knockout Rule
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lead is immediately disqualified if this rule fails
                </p>
              </div>
              <Switch
                id="knockout"
                checked={isKnockout}
                onCheckedChange={setIsKnockout}
              />
            </div>

            {/* Reasoning */}
            <div className="space-y-2">
              <Label htmlFor="reasoning">Reasoning (Optional)</Label>
              <Textarea
                id="reasoning"
                placeholder="Explain why this rule exists..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-border p-4">
          <div>
            {rule && onDelete && (
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
              {isCreating ? 'Create Rule' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirmation */}
      {rule && (() => {
        const isHighImpact = Math.abs(rule.score_weight) >= 50;
        const hasWarnings = rule.is_knockout || isHighImpact;

        return (
          <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="Delete ICP Rule"
            description={
              <>
                Are you sure you want to delete <strong>"{rule.display_name}"</strong>?
                {hasWarnings && (
                  <div className="mt-3 space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                    <p className="font-medium text-warning-foreground">⚠️ Usage Impact Warning</p>
                    {rule.is_knockout && (
                      <p className="flex items-center gap-2 text-warning-foreground">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>This is a <strong>knockout rule</strong> - leads failing this rule are immediately disqualified.</span>
                      </p>
                    )}
                    {isHighImpact && (
                      <p className="flex items-center gap-2 text-warning-foreground">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          This rule has a <strong>high score weight ({rule.score_weight > 0 ? '+' : ''}{rule.score_weight})</strong> -
                          removing it will significantly affect lead scoring calculations.
                        </span>
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted-foreground">
                  This action cannot be undone.
                </p>
              </>
            }
            confirmLabel={hasWarnings ? 'Delete Anyway' : 'Delete'}
            onConfirm={() => {
              onDelete?.();
              setDeleteConfirmOpen(false);
            }}
            isLoading={isDeleting}
            variant="danger"
          />
        );
      })()}
    </>
  );
}

/**
 * Empty state when no rule is selected
 */
export function ICPRuleEditorEmpty({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <Zap className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">No rule selected</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Select a rule from the list to edit it, or create a new one.
      </p>
      <Button className="mt-4" onClick={onCreateNew}>
        Create New Rule
      </Button>
    </div>
  );
}
