import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { User, Hash } from 'lucide-react';

export interface MentionItem {
  id: string;
  label: string;
  type?: string; // 'user' | 'item'
  extra?: string; // space name, item type, etc.
}

export interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) {
            command(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-2 text-sm text-muted-foreground">
          Aucun résultat
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto min-w-[200px]">
        {items.map((item, index) => {
          const isItem = item.type === 'item';
          return (
            <button
              key={item.id}
              onClick={() => command(item)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent'
              }`}
            >
              {isItem ? (
                <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
              {item.extra && (
                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                  {item.extra}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';
