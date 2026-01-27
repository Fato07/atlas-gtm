/**
 * BulkImportDialog component
 * Dialog for bulk importing ICP rules from JSON
 */
import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateICPRuleRequest, BulkImportICPRulesRequest } from '@/hooks/useICPRules';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: BulkImportICPRulesRequest) => Promise<{
    imported: number;
    skipped: number;
    errors: Array<{ index: number; error: string }>;
  }>;
  isImporting?: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

const EXAMPLE_JSON = `[
  {
    "category": "firmographic",
    "attribute": "company_size",
    "display_name": "Company Size (11-200)",
    "condition": {
      "operator": "in",
      "value": ["11-50", "51-200"]
    },
    "score_weight": 25,
    "is_knockout": false,
    "reasoning": "Target mid-size companies"
  }
]`;

export function BulkImportDialog({
  open,
  onOpenChange,
  onImport,
  isImporting,
}: BulkImportDialogProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [ruleCount, setRuleCount] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      setParseError(null);
      setResult(null);
    };
    reader.onerror = () => {
      setParseError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const validateAndParse = (): CreateICPRuleRequest[] | null => {
    try {
      const parsed = JSON.parse(jsonInput);

      if (!Array.isArray(parsed)) {
        setParseError('JSON must be an array of rules');
        return null;
      }

      if (parsed.length === 0) {
        setParseError('Array cannot be empty');
        return null;
      }

      if (parsed.length > 100) {
        setParseError('Maximum 100 rules per import');
        return null;
      }

      // Basic validation
      for (let i = 0; i < parsed.length; i++) {
        const rule = parsed[i];
        if (!rule.category || !rule.attribute || !rule.display_name || !rule.condition) {
          setParseError(
            `Rule at index ${i} is missing required fields (category, attribute, display_name, condition)`
          );
          return null;
        }
        if (!rule.condition.operator || rule.condition.value === undefined) {
          setParseError(`Rule at index ${i} has invalid condition`);
          return null;
        }
        if (typeof rule.score_weight !== 'number') {
          setParseError(`Rule at index ${i} is missing score_weight`);
          return null;
        }
      }

      setParseError(null);
      return parsed;
    } catch {
      setParseError('Invalid JSON format');
      return null;
    }
  };

  const handleImport = async () => {
    const rules = validateAndParse();
    if (!rules) return;

    setRuleCount(rules.length);
    setIsCancelled(false);
    abortControllerRef.current = new AbortController();

    try {
      const importResult = await onImport({
        rules,
        replace_existing: replaceExisting,
      });

      // Check if cancelled before setting result
      if (isCancelled || abortControllerRef.current?.signal.aborted) {
        return;
      }

      setResult(importResult);

      // If successful with no errors, close after a delay
      if (importResult.errors.length === 0 && importResult.imported > 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      if (!isCancelled) {
        setParseError(error instanceof Error ? error.message : 'Import failed');
      }
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    abortControllerRef.current?.abort();
    setRuleCount(0);
    // Note: The actual API call cannot be cancelled, but we prevent UI updates
  };

  const handleClose = () => {
    handleCancel();
    setJsonInput('');
    setReplaceExisting(false);
    setParseError(null);
    setResult(null);
    setRuleCount(0);
    setIsCancelled(false);
    onOpenChange(false);
  };

  const loadExample = () => {
    setJsonInput(EXAMPLE_JSON);
    setParseError(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Bulk Import ICP Rules
          </DialogTitle>
          <DialogDescription>
            Import multiple ICP rules from a JSON file or paste JSON directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator during import */}
          {isImporting && ruleCount > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Importing {ruleCount} rules...</p>
                    <p className="text-sm text-muted-foreground">
                      {replaceExisting
                        ? 'Replacing existing rules and importing new ones'
                        : 'Adding rules to existing collection'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
              {/* Progress bar animation */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-1/2 animate-pulse rounded-full bg-primary"
                  style={{
                    animation: 'progressIndeterminate 1.5s ease-in-out infinite',
                  }}
                />
              </div>
              <style>{`
                @keyframes progressIndeterminate {
                  0% { transform: translateX(-100%); width: 50%; }
                  50% { width: 30%; }
                  100% { transform: translateX(300%); width: 50%; }
                }
              `}</style>
            </div>
          )}

          {/* Result display */}
          {result && (
            <Alert variant={result.errors.length > 0 ? 'destructive' : 'default'}>
              {result.errors.length > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="font-medium">
                  Imported: {result.imported}, Skipped: {result.skipped}
                  {result.errors.length > 0 && `, Errors: ${result.errors.length}`}
                </div>
                {result.errors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>
                        Rule {err.index}: {err.error}
                      </li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more errors</li>
                    )}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* File upload */}
          <div className="space-y-2">
            <Label>Upload JSON File</Label>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 px-4 py-3 hover:border-muted-foreground/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Choose file...</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <Button variant="outline" size="sm" onClick={loadExample}>
                Load Example
              </Button>
            </div>
          </div>

          {/* JSON input */}
          <div className="space-y-2">
            <Label htmlFor="json-input">JSON Content</Label>
            <Textarea
              id="json-input"
              placeholder="Paste JSON array of rules here..."
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setParseError(null);
                setResult(null);
              }}
              rows={10}
              className="font-mono text-sm"
            />
            {parseError && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {parseError}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <Label htmlFor="replace-existing" className="font-medium">
                Replace Existing Rules
              </Label>
              <p className="text-xs text-muted-foreground">
                Delete all existing rules before importing
              </p>
            </div>
            <Switch
              id="replace-existing"
              checked={replaceExisting}
              onCheckedChange={setReplaceExisting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!jsonInput.trim() || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Rules
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
