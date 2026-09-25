'use client';

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormStatus } from '@formgl/shared';
import { cn } from '@/lib/admin/utils';

/* ───────────────────────── Buttons ───────────────────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
const variants: Record<Variant, string> = {
  primary: 'bg-(--accent) text-white hover:bg-[#7a1616] shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_1px_2px_rgba(80,20,20,.25)]',
  secondary: 'bg-white text-(--ink) border border-(--line) hover:border-(--line-2) hover:bg-[#fcfaf6] shadow-[0_1px_2px_rgba(60,40,20,.05)]',
  ghost: 'text-(--ink-2) hover:bg-(--paper-2) hover:text-(--ink)',
  subtle: 'bg-(--paper-2) text-(--ink) hover:bg-[#e7dece]',
  danger: 'bg-white text-[#9b1c1c] border border-[#ecc9c3] hover:bg-[#fbf0ed]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && (children ? 'h-8 px-2.5 text-[13px]' : 'size-8'),
        size === 'md' && (children ? 'h-9 px-3.5 text-sm' : 'size-9'),
        size === 'lg' && (children ? 'h-11 px-5 text-[15px]' : 'size-11'),
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconR && <IconR className="size-4" aria-hidden />}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, size = 'md', active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md'; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-(--ink-2) transition-colors hover:bg-(--paper-2) hover:text-(--ink) disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'size-7' : 'size-9',
        active && 'bg-(--accent-soft) text-(--accent)',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
    </button>
  );
}

/* ───────────────────────── Inputs ───────────────────────── */

const inputBase =
  'w-full rounded-lg border border-(--line) bg-white px-3 text-sm text-(--ink) placeholder:text-(--ink-3) transition-colors hover:border-(--line-2) focus:border-(--accent) focus:outline-none focus:ring-3 focus:ring-(--accent)/10 disabled:bg-(--paper) disabled:opacity-70';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, 'h-9', className)} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'min-h-20 py-2 leading-relaxed', className)} {...rest} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        inputBase,
        'h-9 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b5f57%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[position:right_10px_center] bg-no-repeat pr-8',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Number input that maps "" → undefined */
export function NumberInput({ value, onValue, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null | undefined; onValue: (v: number | undefined) => void }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => onValue(e.target.value === '' ? undefined : Number(e.target.value))}
      className={className}
      {...rest}
    />
  );
}

export function Switch({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string; disabled?: boolean }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-(--accent)' : 'bg-[#d9cfc2]',
      )}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/** Label + control wrapper. `children` may be a render fn receiving the generated id. */
export function Field({ label, hint, children, className, inline }: { label: ReactNode; hint?: ReactNode; children: ReactNode | ((id: string) => ReactNode); className?: string; inline?: boolean }) {
  const id = useId();
  const control = typeof children === 'function' ? children(id) : children;
  if (inline)
    return (
      <div className={cn('flex items-center justify-between gap-3 py-1', className)}>
        <label htmlFor={id} className="min-w-0 text-sm text-(--ink)">
          {label}
          {hint && <span className="mt-0.5 block text-xs text-(--ink-3)">{hint}</span>}
        </label>
        {control}
      </div>
    );
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-(--ink)">
        {label}
      </label>
      {control}
      {hint && <p className="text-xs text-(--ink-3)">{hint}</p>}
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return <Field inline label={label} hint={hint}>{(id) => <Switch id={id} checked={checked} onChange={onChange} />}</Field>;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-(--line) bg-white p-1.5 pr-2">
      <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="size-8 shrink-0" aria-label={label} />
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-[13px] text-(--ink)">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} hex`}
        className="w-[76px] rounded-md bg-(--paper) px-1.5 py-1 font-mono text-xs uppercase text-(--ink-2) focus:outline-none focus:ring-2 focus:ring-(--accent)/20"
      />
    </div>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, label, size = 'md', className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode; icon?: LucideIcon }>; label: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap gap-0.5 rounded-lg bg-(--paper-2) p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-all',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-white text-(--ink) shadow-[0_1px_2px_rgba(60,40,20,.12)]' : 'text-(--ink-2) hover:text-(--ink)',
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Surfaces ───────────────────────── */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-(--line) bg-white shadow-[0_1px_2px_rgba(60,40,20,.04),0_4px_16px_-8px_rgba(60,40,20,.08)]', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h3 className="text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">{children}</h3>
      {action}
    </div>
  );
}

const statusStyles: Record<FormStatus, string> = {
  draft: 'bg-[#f1ebe1] text-[#7a6b5d] ring-[#e2d8c9]',
  published: 'bg-[#e8f3ea] text-[#276640] ring-[#cfe5d4]',
  closed: 'bg-[#f7e6e3] text-[#8e1b1b] ring-[#eccbc5]',
};
export function StatusBadge({ status }: { status: FormStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset', statusStyles[status])}>
      <span className={cn('size-1.5 rounded-full', status === 'published' ? 'bg-[#2f8a52]' : status === 'closed' ? 'bg-(--accent)' : 'bg-[#a8998a]')} />
      {status}
    </span>
  );
}

export function Chip({ children, className, onRemove }: { children: ReactNode; className?: string; onRemove?: () => void }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md bg-(--paper-2) px-1.5 py-0.5 text-xs text-(--ink)', className)}>
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="rounded text-(--ink-3) hover:text-(--ink)">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-(--ink-3)', className)} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-(--ink-3)">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-(--accent-soft) text-(--accent)">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <h3 className="font-display text-2xl font-semibold text-(--ink)">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-(--ink-2)">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Overlays ───────────────────────── */

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(els).filter((el) => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button');
      el?.focus();
    }, 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fgl-admin fixed inset-0 z-[100] !min-h-0 !bg-transparent">
      <div className="fgl-anim-fade absolute inset-0 bg-[#2b2320]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className={cn(
            'fgl-anim-pop pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-(--line) bg-white shadow-[0_24px_64px_-12px_rgba(43,35,32,.35)] sm:rounded-2xl',
            size === 'sm' && 'sm:max-w-md',
            size === 'md' && 'sm:max-w-xl',
            size === 'lg' && 'sm:max-w-3xl',
            size === 'xl' && 'sm:max-w-5xl',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-(--line) px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="font-display text-2xl leading-tight font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-(--ink-2)">{description}</p>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" />
          </div>
          <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-(--line) bg-[#fcfaf6] px-5 py-3 sm:rounded-b-2xl sm:px-6">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fgl-admin fixed inset-0 z-[90] !min-h-0 !bg-transparent">
      <div className="fgl-anim-fade absolute inset-0 bg-[#2b2320]/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" className={cn('fgl-anim-slide absolute inset-y-0 right-0 flex w-full flex-col border-l border-(--line) bg-(--paper) shadow-2xl', width)}>
        <div className="flex items-center justify-between gap-3 border-b border-(--line) bg-white px-5 py-3.5">
          <div className="min-w-0 flex-1">{title}</div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-(--line) bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, loading, danger = true }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" className={danger ? '' : ''} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-(--ink-2)">{message}</div>
    </Modal>
  );
}

/* ───────────────────────── Menu ───────────────────────── */

export function Menu({ trigger, children, align = 'end' }: { trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);
  return (
    <div ref={ref} className="relative">
      {trigger({ onClick: () => setOpen(!open), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div role="menu" className={cn('fgl-anim-pop absolute top-full z-50 mt-1 min-w-48 rounded-xl border border-(--line) bg-white p-1 shadow-[0_12px_32px_-8px_rgba(43,35,32,.25)]', align === 'end' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, href, target }: { icon?: LucideIcon; children: ReactNode; onClick?: () => void; danger?: boolean; href?: string; target?: string }) {
  const cls = cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors', danger ? 'text-[#9b1c1c] hover:bg-[#fbf0ed]' : 'text-(--ink) hover:bg-(--paper)');
  const inner = (
    <>
      {Icon && <Icon className="size-4 opacity-70" aria-hidden />}
      {children}
    </>
  );
  if (href)
    return (
      <a role="menuitem" href={href} target={target} rel={target ? 'noreferrer' : undefined} className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  return (
    <button role="menuitem" type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
