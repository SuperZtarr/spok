import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { tagsApi } from '../../lib/api';
import type { Tag } from '@spok/shared';
import { TagBadge } from './TagBadge';

interface TagSelectorProps {
  spaceId: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ spaceId, value, onChange, disabled }: TagSelectorProps) {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: spaceTags = [] } = useQuery({
    queryKey: ['tags', spaceId],
    queryFn: () => tagsApi.list(spaceId),
    enabled: !!spaceId,
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => tagsApi.create(spaceId, { name }),
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags', spaceId] });
      onChange([...value, newTag.id]);
      setInputValue('');
      setIsOpen(false);
    },
  });

  // Resolve selected tag IDs to Tag objects
  const selectedTags = useMemo(() => {
    return value
      .map((id) => spaceTags.find((t) => t.id === id))
      .filter(Boolean) as Tag[];
  }, [value, spaceTags]);

  // Filter suggestions: match input, exclude already selected
  const suggestions = useMemo(() => {
    const query = inputValue.toLowerCase().trim();
    return spaceTags.filter(
      (t) =>
        !value.includes(t.id) &&
        (query === '' || t.name.toLowerCase().includes(query))
    );
  }, [spaceTags, value, inputValue]);

  // Check if input matches exactly an existing tag name
  const exactMatch = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return query ? spaceTags.some((t) => t.name.toLowerCase() === query) : true;
  }, [spaceTags, inputValue]);

  // Can create: input not empty, no exact match
  const canCreate = inputValue.trim().length > 0 && !exactMatch;

  // Total options count (suggestions + optional create)
  const totalOptions = suggestions.length + (canCreate ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions.length, canCreate]);

  const handleSelect = useCallback(
    (tag: Tag) => {
      onChange([...value, tag.id]);
      setInputValue('');
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (tagId: string) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange]
  );

  const handleCreate = useCallback(() => {
    const name = inputValue.trim();
    if (name && !createTagMutation.isPending) {
      createTagMutation.mutate(name);
    }
  }, [inputValue, createTagMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, totalOptions - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isOpen || totalOptions === 0) return;
        if (highlightIndex < suggestions.length) {
          handleSelect(suggestions[highlightIndex]);
        } else if (canCreate) {
          handleCreate();
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
        // Remove last tag on backspace when input is empty
        onChange(value.slice(0, -1));
      }
    },
    [isOpen, totalOptions, highlightIndex, suggestions, canCreate, handleSelect, handleCreate, inputValue, value, onChange]
  );

  return (
    <div className="relative">
      {/* Selected tags + input */}
      <div
        className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md bg-background min-h-[38px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={disabled ? undefined : () => handleRemove(tag.id)}
          />
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? 'Ajouter des tags...' : ''}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && !disabled && totalOptions > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1 max-h-48 overflow-y-auto"
        >
          {suggestions.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleSelect(tag)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors ${
                index === highlightIndex ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              {tag.color && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              <span className="truncate">{tag.name}</span>
              {(tag as any).isCommunityTag && (
                <span className="text-[10px] text-blue-500 bg-blue-500/10 px-1 rounded">communauté</span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {(tag as Tag & { itemCount?: number }).itemCount ?? 0}
              </span>
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={createTagMutation.isPending}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-primary transition-colors ${
                highlightIndex === suggestions.length ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer « {inputValue.trim()} »</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
