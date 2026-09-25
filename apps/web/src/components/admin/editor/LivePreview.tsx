'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Mail, MailOpen, Monitor, RefreshCw, Smartphone, X } from 'lucide-react';
import { useEditor } from '@/lib/admin/editor-store';
import { cn } from '@/lib/admin/utils';
import { IconButton, Segmented, Spinner } from '../ui';

const DEVICES = {
  phone: { w: 390, h: 844 },
  desktop: { w: 1280, h: 800 },
} as const;
type Device = keyof typeof DEVICES;

/**
 * The real, 3D letter rendering the current draft, docked beside the editor. It reloads a
 * moment after each save (baked textures are cached, so reloads are quick).
 */
export function LivePreview({ onClose }: { onClose: () => void }) {
  const form = useEditor((s) => s.form);
  const saveState = useEditor((s) => s.saveState);
  const [device, setDevice] = useState<Device>('phone');
  const [state, setState] = useState<'idle' | 'letter'>('idle');
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const lastSaved = useRef(saveState);

  // refresh after a save lands
  useEffect(() => {
    const was = lastSaved.current;
    lastSaved.current = saveState;
    if (saveState === 'saved' && was === 'saving') {
      const t = setTimeout(() => setNonce((n) => n + 1), 700);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  // fit the device into the panel
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const d = DEVICES[device];
      const r = el.getBoundingClientRect();
      setScale(Math.min((r.width - 32) / d.w, (r.height - 64) / d.h, 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  useEffect(() => setLoading(true), [nonce, device, state]);

  if (!form) return null;
  const d = DEVICES[device];
  const src = `/${form.slug}?preview=1&fgl=${state === 'letter' ? 'letter' : 'idle'}&n=${nonce}`;

  return (
    <aside className="hidden w-[min(42vw,560px)] shrink-0 flex-col border-l border-(--line) bg-[#efe8dc] lg:flex" aria-label="Live preview">
      <div className="flex items-center gap-1.5 border-b border-(--line) bg-white px-3 py-2">
        <span className="mr-1 text-[13px] font-semibold">Live preview</span>
        <Segmented
          label="Device"
          size="sm"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'phone', label: '', icon: Smartphone },
            { value: 'desktop', label: '', icon: Monitor },
          ]}
        />
        <Segmented
          label="Show"
          size="sm"
          value={state}
          onChange={setState}
          options={[
            { value: 'idle', label: 'Scene', icon: Mail },
            { value: 'letter', label: 'Letter', icon: MailOpen },
          ]}
        />
        <span className="flex-1" />
        {(loading || saveState === 'saving') && <Spinner className="size-4" />}
        <IconButton icon={RefreshCw} label="Reload preview" size="sm" onClick={() => setNonce((n) => n + 1)} />
        <IconButton icon={ExternalLink} label="Open in a new tab" size="sm" onClick={() => window.open(src.replace(/&fgl=\w+/, ''), '_blank', 'noopener')} />
        <IconButton icon={X} label="Close preview" size="sm" onClick={onClose} />
      </div>
      <div ref={box} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        <div
          className={cn('relative overflow-hidden bg-(--paper) shadow-[0_24px_60px_-20px_rgba(43,35,32,.45)]', device === 'phone' ? 'rounded-[36px] ring-[10px] ring-[#1d1a18]' : 'rounded-xl ring-1 ring-black/10')}
          style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: 'center', flex: 'none' }}
        >
          <iframe key={`${src}|${device}`} src={src} title="Live preview of the letter" className="h-full w-full border-0" onLoad={() => setLoading(false)} allow="autoplay; fullscreen" />
        </div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-[11.5px] text-(--ink-3)">Shows your draft · reloads after each save</p>
      </div>
    </aside>
  );
}
