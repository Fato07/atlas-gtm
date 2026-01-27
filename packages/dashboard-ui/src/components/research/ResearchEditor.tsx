/**
 * ResearchEditor component
 * Form for creating and editing research documents
 */
import { useState, useEffect } from 'react';
import { Loader2, Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MarketResearch,
  ContentType,
  CreateResearchRequest,
  UpdateResearchRequest,
  getContentTypeDisplayName,
} from '@/hooks/useResearch';

interface ResearchEditorProps {
  document?: MarketResearch;
  isCreating?: boolean;
  isSaving?: boolean;
  onSave?: (data: CreateResearchRequest | UpdateResearchRequest) => void;
  onCancel?: () => void;
  availableTags?: string[];
}

const CONTENT_TYPES: ContentType[] = ['article', 'report', 'transcript', 'notes', 'other'];

export function ResearchEditor({
  document,
  isCreating,
  isSaving,
  onSave,
  onCancel,
  availableTags = [],
}: ResearchEditorProps) {
  // Form state
  const [title, setTitle] = useState(document?.title ?? '');
  const [contentType, setContentType] = useState<ContentType>(
    document?.content_type ?? 'article'
  );
  const [content, setContent] = useState(document?.content ?? '');
  const [source, setSource] = useState(document?.source ?? '');
  const [sourceUrl, setSourceUrl] = useState(document?.source_url ?? '');
  const [tags, setTags] = useState<string[]>(document?.tags ?? []);
  const [keyFacts, setKeyFacts] = useState<string[]>(document?.key_facts ?? []);
  const [newTag, setNewTag] = useState('');
  const [newFact, setNewFact] = useState('');

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContentType(document.content_type);
      setContent(document.content);
      setSource(document.source ?? '');
      setSourceUrl(document.source_url ?? '');
      setTags(document.tags);
      setKeyFacts(document.key_facts);
    } else if (isCreating) {
      setTitle('');
      setContentType('article');
      setContent('');
      setSource('');
      setSourceUrl('');
      setTags([]);
      setKeyFacts([]);
    }
  }, [document, isCreating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreating) {
      const data: CreateResearchRequest = {
        title,
        content_type: contentType,
        content,
        source: source || undefined,
        source_url: sourceUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
      onSave?.(data);
    } else {
      const data: UpdateResearchRequest = {
        title,
        content,
        key_facts: keyFacts,
        tags,
      };
      onSave?.(data);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const addFact = () => {
    if (newFact.trim() && !keyFacts.includes(newFact.trim())) {
      setKeyFacts([...keyFacts, newFact.trim()]);
      setNewFact('');
    }
  };

  const removeFact = (index: number) => {
    setKeyFacts(keyFacts.filter((_, i) => i !== index));
  };

  const isValid = title.trim() && content.trim();

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-medium">
          {isCreating ? 'New Research Document' : 'Edit Research Document'}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!isValid || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Form content */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title..."
              maxLength={200}
            />
          </div>

          {/* Content Type (only for create) */}
          {isCreating && (
            <div className="space-y-2">
              <Label htmlFor="content-type">Content Type *</Label>
              <Select
                value={contentType}
                onValueChange={(v) => setContentType(v as ContentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getContentTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Source (only for create) */}
          {isCreating && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g., McKinsey Report"
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-url">Source URL</Label>
                <Input
                  id="source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter document content...&#10;&#10;Use markdown formatting for structure:&#10;- Bullet points&#10;- **Bold text**&#10;- # Headings"
              rows={12}
              className="font-mono text-sm"
              maxLength={50000}
            />
            <p className="text-xs text-muted-foreground">
              {content.length.toLocaleString()} / 50,000 characters
            </p>
          </div>

          {/* Key Facts (only for edit) */}
          {!isCreating && (
            <div className="space-y-2">
              <Label>Key Facts</Label>
              <p className="text-xs text-muted-foreground">
                Key facts are automatically extracted from content. You can add or remove them.
              </p>
              <div className="space-y-2">
                {keyFacts.map((fact, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-md border border-border p-2"
                  >
                    <span className="flex-1 text-sm">{fact}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeFact(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="Add a key fact..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addFact();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addFact}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggested tags */}
            {availableTags.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Suggestions:</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {availableTags
                    .filter((t) => !tags.includes(t))
                    .slice(0, 6)
                    .map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => setTags([...tags, tag])}
                      >
                        + {tag}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </form>
  );
}

/**
 * Empty state component for when no document is selected
 */
export function ResearchEditorEmpty({ onCreateNew }: { onCreateNew?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-foreground">No document selected</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a document from the list or create a new one
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onCreateNew}>
        <Plus className="mr-2 h-4 w-4" />
        New Document
      </Button>
    </div>
  );
}
