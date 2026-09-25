'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Baseline, Check, Heading2, Heading3, Highlighter, Italic, Link2, List, ListOrdered, Quote, RemoveFormatting,
  Strikethrough, Underline as UnderlineIcon, Unlink, type LucideIcon,
} from 'lucide-react';
import { cn, sanitizeHtml } from '@/lib/admin/utils';

const HIGHLIGHTS = ['#ffe08a', '#fbd3c7', '#cdebd3', '#cfe0f6', '#e8d5f0'];
const COLORS = ['#2b2320', '#8e1b1b', '#b7791f', '#2f7a4a', '#2c5aa0', '#7a3e8e', '#8a7d72'];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
  label?: string;
}

export function RichTextEditor({ value, onChange, placeholder = 'Write something…', minHeight = 96, compact, label = 'Rich text' }: Props) {
  const last = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
        code: false,
        codeBlock: false,
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: { attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : sanitizeHtml(editor.getHTML());
      last.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="overflow-hidden rounded-lg border border-(--line) bg-white transition-colors focus-within:border-(--accent) focus-within:ring-3 focus-within:ring-(--accent)/10">
      {editor && <Toolbar editor={editor} compact={compact} />}
      <EditorContent editor={editor} className="fgl-rich fgl-scroll max-h-[420px] overflow-y-auto px-3 py-2.5 text-sm" style={{ minHeight }} />
    </div>
  );
}

function Toolbar({ editor, compact }: { editor: Editor; compact?: boolean }) {
  const [pop, setPop] = useState<null | 'link' | 'hl' | 'color'>(null);
  const [href, setHref] = useState('');
  const btn = (icon: LucideIcon, label: string, active: boolean, run: () => void) => (
    <ToolBtn key={label} icon={icon} label={label} active={active} onClick={run} />
  );
  const chain = () => editor.chain().focus();
  const applyLink = () => {
    const url = href.trim();
    if (!url) chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:|\/|#)/.test(url) ? url : `https://${url}` }).run();
    setPop(null);
  };
  return (
    <div className="border-b border-(--line) bg-[#fcfaf6]">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1" role="toolbar" aria-label="Formatting">
        {btn(Bold, 'Bold', editor.isActive('bold'), () => chain().toggleBold().run())}
        {btn(Italic, 'Italic', editor.isActive('italic'), () => chain().toggleItalic().run())}
        {btn(UnderlineIcon, 'Underline', editor.isActive('underline'), () => chain().toggleUnderline().run())}
        {btn(Strikethrough, 'Strikethrough', editor.isActive('strike'), () => chain().toggleStrike().run())}
        <Sep />
        <ToolBtn icon={Highlighter} label="Highlight" active={editor.isActive('highlight') || pop === 'hl'} onClick={() => setPop(pop === 'hl' ? null : 'hl')} />
        <ToolBtn icon={Baseline} label="Text color" active={pop === 'color'} onClick={() => setPop(pop === 'color' ? null : 'color')} />
        <ToolBtn
          icon={Link2}
          label="Link"
          active={editor.isActive('link') || pop === 'link'}
          onClick={() => {
            setHref((editor.getAttributes('link').href as string) || '');
            setPop(pop === 'link' ? null : 'link');
          }}
        />
        {editor.isActive('link') && btn(Unlink, 'Remove link', false, () => chain().extendMarkRange('link').unsetLink().run())}
        <Sep />
        {!compact && btn(Heading2, 'Heading', editor.isActive('heading', { level: 2 }), () => chain().toggleHeading({ level: 2 }).run())}
        {!compact && btn(Heading3, 'Subheading', editor.isActive('heading', { level: 3 }), () => chain().toggleHeading({ level: 3 }).run())}
        {btn(List, 'Bullet list', editor.isActive('bulletList'), () => chain().toggleBulletList().run())}
        {btn(ListOrdered, 'Numbered list', editor.isActive('orderedList'), () => chain().toggleOrderedList().run())}
        {btn(Quote, 'Quote', editor.isActive('blockquote'), () => chain().toggleBlockquote().run())}
        <Sep />
        {btn(AlignLeft, 'Align left', editor.isActive({ textAlign: 'left' }), () => chain().setTextAlign('left').run())}
        {btn(AlignCenter, 'Align center', editor.isActive({ textAlign: 'center' }), () => chain().setTextAlign('center').run())}
        {btn(AlignRight, 'Align right', editor.isActive({ textAlign: 'right' }), () => chain().setTextAlign('right').run())}
        <Sep />
        {btn(RemoveFormatting, 'Clear formatting', false, () => chain().unsetAllMarks().clearNodes().run())}
      </div>
      {pop === 'hl' && (
        <Swatches
          colors={HIGHLIGHTS}
          current={editor.getAttributes('highlight').color as string | undefined}
          onPick={(c) => {
            chain().toggleHighlight({ color: c }).run();
            setPop(null);
          }}
          onClear={() => {
            chain().unsetHighlight().run();
            setPop(null);
          }}
        />
      )}
      {pop === 'color' && (
        <Swatches
          colors={COLORS}
          current={editor.getAttributes('textStyle').color as string | undefined}
          custom
          onPick={(c) => chain().setColor(c).run()}
          onClear={() => {
            chain().unsetColor().run();
            setPop(null);
          }}
        />
      )}
      {pop === 'link' && (
        <form
          className="flex items-center gap-1.5 border-t border-(--line) px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://…"
            aria-label="Link URL"
            className="h-7 min-w-0 flex-1 rounded-md border border-(--line) px-2 text-xs focus:border-(--accent) focus:outline-none"
          />
          <ToolBtn icon={Check} label="Apply link" onClick={applyLink} type="submit" />
        </form>
      )}
    </div>
  );
}

function Swatches({ colors, current, onPick, onClear, custom }: { colors: string[]; current?: string; onPick: (c: string) => void; onClear: () => void; custom?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-(--line) px-2 py-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className={cn('size-6 rounded-md border border-black/10 transition-transform hover:scale-110', current?.toLowerCase() === c && 'ring-2 ring-(--accent) ring-offset-1')}
          style={{ background: c }}
        />
      ))}
      {custom && <input type="color" aria-label="Custom color" className="size-6" onChange={(e) => onPick(e.target.value)} />}
      <button type="button" onClick={onClear} className="ml-1 rounded-md px-1.5 py-0.5 text-xs text-(--ink-2) hover:bg-(--paper-2)">
        None
      </button>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, active, onClick, type = 'button' }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('grid size-7 place-items-center rounded-md text-(--ink-2) transition-colors hover:bg-(--paper-2) hover:text-(--ink)', active && 'bg-(--accent-soft) text-(--accent)')}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-4 w-px bg-(--line)" aria-hidden />;

/** Read-only sanitized rich text */
export function RichHtml({ html, className }: { html?: string; className?: string }) {
  if (!html) return null;
  return <div className={cn('fgl-rich', className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
