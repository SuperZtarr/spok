import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  GripHorizontal,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  resizable?: boolean;
  minHeight?: number;
  defaultMaxHeight?: number;
}

export function RichTextEditor({ content, onChange, placeholder, editable = true, resizable = true, minHeight = 120, defaultMaxHeight = 300 }: RichTextEditorProps) {
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline hover:no-underline' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Ajoutez une description...',
      }),
    ],
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
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
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
          title="Souligné"
        >
          <UnderlineIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Barré"
        >
          <Strikethrough size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Titre"
        >
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Liste à puces"
        >
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Liste numérotée"
        >
          <ListOrdered size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={toggleLink}
          isActive={editor.isActive('link')}
          title="Lien"
        >
          <LinkIcon size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Annuler"
        >
          <Undo size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Rétablir"
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
          className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-full focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[96px]"
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
