'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Copy, GitBranch, GripVertical, Plus, Search, Trash2, FileText, EyeOff } from 'lucide-react';
import { FIELD_CATALOG, FIELD_META, isInputField, paginate, type FieldMeta, type FieldType, type FormField } from '@formgl/shared';
import { useEditor } from '@/lib/admin/editor-store';
import { cn, stripHtml } from '@/lib/admin/utils';
import { Button, Drawer, EmptyState, IconButton, Input, Modal } from '../ui';
import { FieldIcon } from '../FieldIcon';
import { FieldProperties } from './FieldProperties';

const GROUP_LABELS: Record<FieldMeta['group'], string> = {
  text: 'Text & numbers',
  contact: 'Contact',
  choice: 'Choices',
  scale: 'Ratings & scales',
  datetime: 'Date & time',
  media: 'Uploads & signature',
  advanced: 'Advanced',
  content: 'Content blocks',
};
const GROUP_ORDER: FieldMeta['group'][] = ['text', 'choice', 'scale', 'contact', 'datetime', 'media', 'advanced', 'content'];

function useIsDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

export function BuildTab() {
  const isDesktop = useIsDesktop();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const selectedId = useEditor((s) => s.selectedId);

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[232px_minmax(0,1fr)_360px] xl:grid-cols-[256px_minmax(0,1fr)_380px]">
      <aside className="fgl-scroll hidden overflow-y-auto border-r border-(--line) bg-[#fbf8f3] lg:block" aria-label="Add fields">
        <Palette />
      </aside>
      <section className="fgl-scroll min-w-0 overflow-y-auto px-3 py-5 sm:px-6" aria-label="Letter fields">
        <FieldList onEdit={() => !isDesktop && setPropsOpen(true)} />
        <div className="h-24 lg:hidden" />
      </section>
      <aside className="fgl-scroll hidden overflow-y-auto border-l border-(--line) bg-white lg:block" aria-label="Field properties">
        <FieldProperties />
      </aside>

      {/* mobile affordances */}
      {!isDesktop && (
        <>
          <div className="fixed right-4 bottom-4 z-30 lg:hidden">
            <Button variant="primary" size="lg" icon={Plus} onClick={() => setPaletteOpen(true)} className="rounded-full shadow-lg">
              Add field
            </Button>
          </div>
          <Modal open={paletteOpen} onClose={() => setPaletteOpen(false)} title="Add a field" size="lg">
            <Palette onAdded={() => setPaletteOpen(false)} />
          </Modal>
          <Drawer open={propsOpen && !!selectedId} onClose={() => setPropsOpen(false)} title={<span className="font-semibold">Edit field</span>}>
            <div className="bg-white">
              <FieldProperties />
            </div>
          </Drawer>
        </>
      )}
    </div>
  );
}

function Palette({ onAdded }: { onAdded?: () => void }) {
  const addField = useEditor((s) => s.addField);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GROUP_ORDER.map((g) => ({
      g,
      items: FIELD_CATALOG.filter((m) => m.group === g && (!s || m.label.toLowerCase().includes(s) || m.description.toLowerCase().includes(s))),
    })).filter((x) => x.items.length);
  }, [q]);
  const add = (type: FieldType) => {
    addField(type);
    onAdded?.();
  };
  return (
    <div className="space-y-4 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-(--ink-3)" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a field…" aria-label="Find a field type" className="h-8 pl-8 text-[13px]" />
      </div>
      {groups.map(({ g, items }) => (
        <div key={g}>
          <p className="mb-1 px-1.5 text-[10px] font-semibold tracking-[0.1em] text-(--ink-3) uppercase">{GROUP_LABELS[g]}</p>
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {items.map((m) => (
              <li key={m.type}>
                <button
                  type="button"
                  onClick={() => add(m.type)}
                  title={m.description}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-(--ink) transition-colors hover:bg-white hover:shadow-[0_1px_2px_rgba(60,40,20,.08)]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-(--ink-2) ring-1 ring-(--line) transition-colors group-hover:text-(--accent) group-hover:ring-(--accent)/30">
                    <FieldIcon type={m.type} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <Plus className="size-3.5 text-(--ink-3) opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FieldList({ onEdit }: { onEdit: () => void }) {
  const form = useEditor((s) => s.form);
  const setFields = useEditor((s) => s.setFields);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const fields = form?.fields ?? [];
  const pageStart = useMemo(() => {
    const m = new Map<string, number>();
    paginate(fields, form?.settings.fieldsPerPage ?? 4).forEach((p) => p.fields[0] && m.set(p.fields[0].id, p.index));
    return m;
  }, [fields, form?.settings.fieldsPerPage]);
  const pageCount = pageStart.size;

  if (!form) return null;
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    setFields(arrayMove(fields, from, to));
  };

  if (!fields.length)
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-(--line-2) bg-white/60">
        <EmptyState icon={FileText} title="A blank sheet">
          Add your first question from the palette{' '}
          <span className="lg:hidden">using the “Add field” button</span>.
        </EmptyState>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between text-xs text-(--ink-3)">
        <span>
          {fields.filter((f) => isInputField(f.type)).length} questions · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </span>
        <span className="hidden sm:inline">Drag to reorder · {form.settings.fieldsPerPage} per page</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {fields.map((f, i) => (
              <li key={f.id}>
                {pageStart.has(f.id) && (
                  <div className={cn('flex items-center gap-3 pb-2', i > 0 && 'pt-4')} aria-hidden>
                    <span className="font-display text-lg font-semibold text-(--ink-2) italic">Page {(pageStart.get(f.id) ?? 0) + 1}</span>
                    <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#d8ccbc_0_6px,transparent_6px_10px)]" />
                  </div>
                )}
                <SortableField field={f} index={i} total={fields.length} onEdit={onEdit} />
              </li>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableField({ field, index, total, onEdit }: { field: FormField; index: number; total: number; onEdit: () => void }) {
  const selected = useEditor((s) => s.selectedId === field.id);
  const select = useEditor((s) => s.select);
  const moveField = useEditor((s) => s.moveField);
  const duplicateField = useEditor((s) => s.duplicateField);
  const removeField = useEditor((s) => s.removeField);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const input = isInputField(field.type);
  const meta = FIELD_META[field.type];

  if (field.type === 'page_break')
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('group relative flex items-center gap-2 py-1', isDragging && 'z-10 opacity-80')}>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Drag page break" className="cursor-grab touch-none rounded p-1 text-(--ink-3) hover:text-(--ink) active:cursor-grabbing">
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={() => { select(field.id); onEdit(); }} className={cn('flex flex-1 items-center gap-3 rounded-lg py-1.5', selected && 'bg-(--accent-soft)')}>
          <span className="h-px flex-1 border-t-2 border-dashed border-(--line-2)" />
          <span className="text-[11px] font-semibold tracking-[0.1em] text-(--ink-3) uppercase">Page break</span>
          <span className="h-px flex-1 border-t-2 border-dashed border-(--line-2)" />
        </button>
        <IconButton size="sm" icon={Trash2} label="Delete page break" onClick={() => removeField(field.id)} className="opacity-60 group-hover:opacity-100" />
      </div>
    );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex rounded-xl border bg-white transition-shadow',
        selected ? 'border-(--accent)/60 shadow-[0_0_0_3px_rgba(142,27,27,.08),0_8px_20px_-12px_rgba(60,40,20,.3)]' : 'border-(--line) hover:border-(--line-2) hover:shadow-[0_4px_14px_-8px_rgba(60,40,20,.25)]',
        isDragging && 'z-20 shadow-xl',
        field.width === 'half' && 'sm:mr-[30%]',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder: ${field.label || meta?.label}`}
        className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-xl text-(--ink-3) hover:bg-(--paper) hover:text-(--ink) active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => {
          select(field.id);
          onEdit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(field.id);
            onEdit();
          }
        }}
        className="min-w-0 flex-1 cursor-pointer py-3 pr-2 pl-1 focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-2 text-[11px] text-(--ink-3)">
          <FieldIcon type={field.type} className="size-3.5" />
          <span>{meta?.label}</span>
          {field.required && <span className="font-medium text-(--accent)">Required</span>}
          {field.logic?.conditions?.length ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#eef3f8] px-1 text-[#3f63b0]">
              <GitBranch className="size-3" /> Logic
            </span>
          ) : null}
          {field.type === 'hidden' && (
            <span className="inline-flex items-center gap-0.5">
              <EyeOff className="size-3" /> ?{field.config?.param}
            </span>
          )}
          {field.width === 'half' && <span>½ width</span>}
        </div>
        <FieldPreview field={field} input={input} />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-0.5 py-1.5 pr-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton size="sm" icon={ArrowUp} label="Move up" disabled={index === 0} onClick={() => moveField(field.id, -1)} />
        <IconButton size="sm" icon={ArrowDown} label="Move down" disabled={index === total - 1} onClick={() => moveField(field.id, 1)} />
        <span className="hidden sm:contents">
          <IconButton size="sm" icon={Copy} label="Duplicate" onClick={() => duplicateField(field.id)} />
          <IconButton size="sm" icon={Trash2} label="Delete" onClick={() => removeField(field.id)} />
        </span>
      </div>
    </div>
  );
}

function FieldPreview({ field, input }: { field: FormField; input: boolean }) {
  const c = field.config ?? {};
  if (input)
    return (
      <div className="mt-0.5">
        <p className="truncate text-[15px] font-medium text-(--ink)">{field.label || <span className="text-(--ink-3) italic">Untitled question</span>}</p>
        {field.options?.length ? (
          <p className="mt-1 truncate text-xs text-(--ink-2)">
            {field.options.slice(0, 4).map((o) => o.label).join(' · ')}
            {field.options.length > 4 && ` · +${field.options.length - 4}`}
          </p>
        ) : field.description ? (
          <p className="mt-0.5 truncate text-xs text-(--ink-2)">{stripHtml(field.description)}</p>
        ) : null}
      </div>
    );
  switch (field.type) {
    case 'heading':
      return <p className={cn('font-display mt-0.5 truncate font-semibold', c.level === 1 ? 'text-2xl' : c.level === 3 ? 'text-lg' : 'text-xl')}>{field.label || 'Heading'}</p>;
    case 'paragraph':
    case 'quote':
      return <p className={cn('mt-0.5 line-clamp-2 text-[13px] text-(--ink-2)', field.type === 'quote' && 'border-l-2 border-(--accent) pl-2 italic')}>{stripHtml(c.html) || 'Empty text block'}</p>;
    case 'image':
      return c.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.src} alt={c.alt ?? ''} className="mt-1.5 h-16 max-w-full rounded-md object-cover" />
      ) : (
        <p className="mt-0.5 text-[13px] text-(--ink-3) italic">No image yet</p>
      );
    case 'video':
      return <p className="mt-0.5 truncate text-[13px] text-(--ink-2)">{c.src || <span className="text-(--ink-3) italic">No video yet</span>}</p>;
    case 'divider':
      return <p className="mt-0.5 text-[13px] text-(--ink-2) capitalize">{c.divider ?? 'line'} divider</p>;
    case 'spacer':
      return <div className="mt-1 rounded bg-[repeating-linear-gradient(45deg,#f3ede4_0_6px,#fff_6px_12px)]" style={{ height: Math.min(48, (c.height ?? 32) / 2) }} />;
    default:
      return null;
  }
}
