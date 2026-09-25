'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/admin/api';
import { Button, IconButton, Input } from './ui';

/** Upload to /api/admin/uploads and return the FileRef url. */
export function UploadButton({ onUploaded, accept = 'image/*', label = 'Upload', size = 'sm' }: { onUploaded: (url: string) => void; accept?: string; label?: string; size?: 'sm' | 'md' }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const ref = await api.upload(file);
            onUploaded(ref.url);
            toast.success('Uploaded');
          } catch (err) {
            toast.error(`Upload failed: ${errorMessage(err)}`);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button size={size} icon={Upload} loading={busy} onClick={() => ref.current?.click()} aria-label={label || 'Upload file'} title={label || 'Upload file'}>
        {label}
      </Button>
    </>
  );
}

/** URL input + upload + preview thumbnail */
export function MediaInput({ value, onChange, accept = 'image/*', placeholder = 'https://… or upload', kind = 'image', label }: { value?: string; onChange: (v: string | undefined) => void; accept?: string; placeholder?: string; kind?: 'image' | 'video' | 'audio'; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} placeholder={placeholder} aria-label={label} />
        <UploadButton accept={accept} onUploaded={onChange} label="" size="md" />
        {value && <IconButton icon={Trash2} label={`Remove ${label}`} onClick={() => onChange(undefined)} />}
      </div>
      {value && kind === 'image' && (
        <div className="relative h-24 overflow-hidden rounded-lg border border-(--line) bg-[repeating-conic-gradient(#f3ede4_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-contain" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')} />
        </div>
      )}
      {!value && kind === 'image' && (
        <div className="flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-(--line-2) text-xs text-(--ink-3)">
          <ImageIcon className="size-4" aria-hidden /> No image
        </div>
      )}
    </div>
  );
}
