import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, ReactRenderer, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Link as LinkIcon,
  Undo,
  Redo,
  GripHorizontal,
  Table as TableIcon,
  Code,
  Minus,
  Quote,
} from 'lucide-react';
import { MentionList, type MentionItem, type MentionListRef } from './MentionList';
import { spacesApi } from '../../lib/api';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  resizable?: boolean;
  minHeight?: number;
  defaultMaxHeight?: number;
  spaceId?: string;
  mentionableItems?: Array<{ id: string; title: string; type: string; spaceName?: string }>;
  autoFocus?: boolean;
}

function createSuggestionConfig(
  fetchItems: (query: string) => Promise<MentionItem[]>,
) {
  return {
    items: async ({ query }: { query: string }) => {
      return fetchItems(query);
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate: (props: any) => {
          component?.updateProps(props);
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// Slash command menu items
interface SlashCommandItem {
  title: string;
  command: (editor: Editor) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  { title: 'Titre 2', command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Titre 3', command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Liste a puces', command: (editor) => editor.chain().focus().toggleBulletList().run() },
  { title: 'Liste numerotee', command: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { title: 'Checklist', command: (editor) => editor.chain().focus().toggleTaskList().run() },
  { title: 'Tableau', command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Bloc de code', command: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { title: 'Citation', command: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { title: 'Separateur', command: (editor) => editor.chain().focus().setHorizontalRule().run() },
];

function SlashCommandList({ items, command, selectedIndex }: {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  selectedIndex: number;
}) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl py-1 w-52 max-h-64 overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.title}
          onClick={() => command(item)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            index === selectedIndex ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent/50'
          }`}
        >
          {item.title}
        </button>
      ))}
      {items.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">Aucune commande</p>
      )}
    </div>
  );
}

function createSlashCommandSuggestion() {
  return {
    char: '/',
    startOfLine: true,
    items: ({ query }: { query: string }) => {
      return SLASH_COMMANDS.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase())
      );
    },
    render: () => {
      let component: ReactRenderer<any> | null = null;
      let popup: TippyInstance[] | null = null;
      let selectedIndex = 0;

      return {
        onStart: (props: any) => {
          selectedIndex = 0;
          component = new ReactRenderer(SlashCommandList as any, {
            props: { ...props, selectedIndex, command: (item: SlashCommandItem) => {
              item.command(props.editor);
              popup?.[0]?.hide();
            }},
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate: (props: any) => {
          selectedIndex = 0;
          component?.updateProps({ ...props, selectedIndex, command: (item: SlashCommandItem) => {
            item.command(props.editor);
            popup?.[0]?.hide();
          }});
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          if (event.key === 'ArrowDown') {
            selectedIndex = Math.min(selectedIndex + 1, (component?.props as any)?.items?.length - 1 || 0);
            component?.updateProps({ ...(component.props as any), selectedIndex });
            return true;
          }
          if (event.key === 'ArrowUp') {
            selectedIndex = Math.max(selectedIndex - 1, 0);
            component?.updateProps({ ...(component.props as any), selectedIndex });
            return true;
          }
          if (event.key === 'Enter') {
            const items = (component?.props as any)?.items;
            if (items?.[selectedIndex]) {
              items[selectedIndex].command((component?.props as any)?.editor);
              popup?.[0]?.hide();
            }
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// Slash command extension using Mention mechanism
const SlashCommand = Mention.extend({ name: 'slashCommand' });

export function RichTextEditor({ content, onChange, placeholder, editable = true, resizable = true, minHeight = 120, defaultMaxHeight = 300, spaceId, mentionableItems, autoFocus }: RichTextEditorProps) {
  const isUpdatingFromProp = useRef(false);
  const [editorHeight, setEditorHeight] = useState<number | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = editorContainerRef.current?.offsetHeight ?? defaultMaxHeight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - startY.current;
      const newHeight = Math.max(minHeight, startHeight.current + delta);
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minHeight, defaultMaxHeight]);

  // Build TipTap extensions (memoized to avoid duplicate warnings on re-render)
  const extensions = useMemo(() => {
    const exts: any[] = [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline hover:no-underline' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Ajoutez une description... (tapez / pour les commandes)',
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ];

    // Slash commands
    exts.push(
      SlashCommand.configure({
        suggestion: createSlashCommandSuggestion() as any,
      })
    );

    // @mention extension (users)
    if (spaceId) {
      exts.push(
        Mention.configure({
          HTMLAttributes: {
            class: 'mention-user',
            'data-mention-type': 'user',
          },
          suggestion: createSuggestionConfig(async (query: string) => {
            if (!spaceId) return [];
            try {
              const members = await spacesApi.getMembers(spaceId);
              return members
                .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
                .map((m) => ({ id: m.userId, label: m.name, type: 'user' as const }));
            } catch {
              return [];
            }
          }),
        })
      );
    }

    // #reference extension (items)
    if (mentionableItems) {
      const ItemMention = Mention.extend({ name: 'itemMention' }).configure({
        HTMLAttributes: {
          class: 'mention-item',
          'data-mention-type': 'item',
        },
        suggestion: {
          char: '#',
          ...createSuggestionConfig(async (query: string) => {
            if (!mentionableItems) return [];
            return mentionableItems
              .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((item) => ({
                id: item.id,
                label: item.title,
                type: 'item' as const,
                extra: item.spaceName || item.type,
              }));
          }),
        },
      });
      exts.push(ItemMention);
    }

    return exts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, !!mentionableItems, placeholder]);

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromProp.current) {
        onChange(editor.getHTML());
      }
    },
  });

  // Sync content prop → editor when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isUpdatingFromProp.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
      isUpdatingFromProp.current = false;
    }
  }, [content, editor]);

  // Auto-focus the editor when requested
  useEffect(() => {
    if (autoFocus && editor && !editor.isDestroyed) {
      editor.commands.focus('end');
    }
  }, [autoFocus, editor]);

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL du lien :');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
    disabled,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        disabled ? 'text-muted-foreground/30 cursor-not-allowed' :
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );

  const iconSize = 16;

  return (
    <div className="rounded-md border border-input shadow-sm overflow-hidden">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-muted/30 border-b border-input flex-wrap">
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Gras"
        >
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italique"
        >
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Souligne"
        >
          <UnderlineIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Barre"
        >
          <Strikethrough size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Titre 2"
        >
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Titre 3"
        >
          <Heading3 size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Liste a puces"
        >
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Liste numerotee"
        >
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Checklist"
        >
          <ListChecks size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Blocks */}
        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Inserer un tableau"
          disabled={editor.isActive('table')}
        >
          <TableIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Bloc de code"
        >
          <Code size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Citation"
        >
          <Quote size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Separateur"
        >
          <Minus size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={toggleLink}
          isActive={editor.isActive('link')}
          title="Lien"
        >
          <LinkIcon size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Annuler"
        >
          <Undo size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Retablir"
        >
          <Redo size={iconSize} />
        </ToolbarButton>
      </div>
      )}

      {/* Editor */}
      <div
        ref={editorContainerRef}
        style={editorHeight != null
          ? { height: `${editorHeight}px` }
          : { minHeight: `${minHeight}px`, maxHeight: `${defaultMaxHeight}px` }
        }
        className="overflow-y-auto"
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-full focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[96px] [&_.mention-user]:bg-blue-100 [&_.mention-user]:dark:bg-blue-900/30 [&_.mention-user]:text-blue-700 [&_.mention-user]:dark:text-blue-300 [&_.mention-user]:px-1 [&_.mention-user]:py-0.5 [&_.mention-user]:rounded [&_.mention-user]:font-medium [&_.mention-user]:text-sm [&_.mention-item]:bg-purple-100 [&_.mention-item]:dark:bg-purple-900/30 [&_.mention-item]:text-purple-700 [&_.mention-item]:dark:text-purple-300 [&_.mention-item]:px-1 [&_.mention-item]:py-0.5 [&_.mention-item]:rounded [&_.mention-item]:font-medium [&_.mention-item]:text-sm"
        />
      </div>

      {/* Resize handle */}
      {resizable && editable && (
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-center h-5 cursor-row-resize bg-muted/30 border-t border-input hover:bg-muted/50 transition-colors"
          title="Glisser pour redimensionner"
        >
          <GripHorizontal size={14} className="text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
