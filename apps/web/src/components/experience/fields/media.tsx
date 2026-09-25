'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileRef } from '@formgl/shared';
import { uploadFile } from '@/lib/public/client';
import type { FieldProps } from './common';
import { sfx } from '../audio';

interface Pending {
  key: string;
  name: string;
  progress: number;
  error?: string;
  preview?: string;
}

function accepts(accept: string[] | undefined, file: File) {
  if (!accept?.length) return true;
  const name = file.name.toLowerCase();
  return accept.some((a) => {
    const x = a.trim().toLowerCase();
    if (x.startsWith('.')) return name.endsWith(x);
    if (x.endsWith('/*')) return file.type.startsWith(x.slice(0, -1));
    return file.type === x;
  });
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUpload({ field, value, onChange, inputId, describedBy, slug, demo, error }: FieldProps) {
  const images = field.type === 'image_upload';
  const files: FileRef[] = Array.isArray(value) ? (value as FileRef[]) : [];
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const maxFiles = field.validation?.maxFiles ?? (images ? 3 : 3);
  const maxMb = field.validation?.maxSizeMb ?? 10;
  const accept = field.validation?.accept?.length ? field.validation.accept : images ? ['image/*'] : undefined;

  const handle = useCallback(
    async (list: FileList | File[]) => {
      setMsg('');
      const arr = Array.from(list);
      const room = maxFiles - filesRef.current.length - pending.length;
      if (room <= 0) {
        setMsg(`You can add up to ${maxFiles} file${maxFiles > 1 ? 's' : ''}.`);
        return;
      }
      for (const file of arr.slice(0, room)) {
        if (!accepts(accept, file)) {
          setMsg(`“${file.name}” isn’t an accepted file type.`);
          sfx.error();
          continue;
        }
        if (file.size > maxMb * 1024 * 1024) {
          setMsg(`“${file.name}” is larger than ${maxMb} MB.`);
          sfx.error();
          continue;
        }
        const key = `${file.name}-${file.size}-${Math.random()}`;
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        setPending((p) => [...p, { key, name: file.name, progress: 0, preview }]);
        try {
          const ref = await uploadFile(slug, field.id, file, file.name, (pr) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress: pr } : x))), demo);
          onChange([...filesRef.current, ref]);
          sfx.select();
          setPending((p) => p.filter((x) => x.key !== key));
        } catch (e) {
          setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
          sfx.error();
        }
      }
    },
    [accept, demo, field.id, maxFiles, maxMb, onChange, pending.length, slug],
  );

  return (
    <div className="fgl-upload">
      <div
        className={`fgl-drop${over ? ' over' : ''}${error ? ' invalid' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) void handle(e.dataTransfer.files);
        }}
      >
        <svg viewBox="0 0 48 48" className="fgl-drop-icon" aria-hidden>
          {images ? (
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="10" width="34" height="28" rx="3" />
              <circle cx="17" cy="19" r="3.4" />
              <path d="M8 34l10-9 7 6 6-5 10 8" />
            </g>
          ) : (
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 14 18 26a4 4 0 0 0 5.7 5.7l13-13a7 7 0 1 0-9.9-9.9L13.3 22.3a10 10 0 0 0 14.1 14.1L38 26" />
            </g>
          )}
        </svg>
        <p>
          <button type="button" className="fgl-linkish" onClick={() => inputRef.current?.click()}>
            {images ? 'Choose photos' : 'Choose files'}
          </button>{' '}
          <span className="fgl-drop-or">or drop them here</span>
        </p>
        <p className="fgl-hint-text">
          Up to {maxFiles} · {maxMb} MB each{accept?.length ? ` · ${accept.join(', ')}` : ''}
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          multiple={maxFiles > 1}
          accept={accept?.join(',')}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (e.target.files) void handle(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {msg && (
        <p className="fgl-hint-text warn" role="alert">
          {msg}
        </p>
      )}
      {(files.length > 0 || pending.length > 0) && (
        <ul className={`fgl-files${images ? ' images' : ''}`}>
          {files.map((f) => (
            <li key={f.id} className="fgl-file">
              {f.mime?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.name} />
              ) : (
                <span className="fgl-file-ico" aria-hidden>
                  {f.name.split('.').pop()?.slice(0, 4).toUpperCase()}
                </span>
              )}
              <span className="fgl-file-name">{f.name}</span>
              <span className="fgl-file-size">{fmtSize(f.size)}</span>
              <button type="button" className="fgl-file-x" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x.id !== f.id))}>
                ×
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className={`fgl-file pending${p.error ? ' failed' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.preview ? <img src={p.preview} alt="" /> : <span className="fgl-file-ico" aria-hidden>…</span>}
              <span className="fgl-file-name">{p.error ? p.error : p.name}</span>
              {!p.error && (
                <span className="fgl-file-bar" aria-label={`Uploading ${Math.round(p.progress * 100)}%`}>
                  <span style={{ width: `${p.progress * 100}%` }} />
                </span>
              )}
              {p.error && (
                <button type="button" className="fgl-file-x" aria-label="Dismiss" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Signature({ field, value, onChange, inputId, describedBy, slug, demo }: FieldProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const dirty = useRef(false);
  const [status, setStatus] = useState<'empty' | 'drawn' | 'saving' | 'saved' | 'error'>(Array.isArray(value) && value.length ? 'saved' : 'empty');
  const saved = Array.isArray(value) ? (value as FileRef[])[0] : undefined;
  const ink = typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--fgl-ink') || '#2b2320' : '#2b2320';

  const resize = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }, []);
  useEffect(() => {
    resize();
  }, [resize]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const save = async () => {
    const c = canvas.current;
    if (!c || !dirty.current) return;
    setStatus('saving');
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) return setStatus('error');
    try {
      const ref = await uploadFile(slug, field.id, blob, 'signature.png', undefined, demo);
      onChange([ref]);
      dirty.current = false;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
    setStatus('empty');
  };

  return (
    <div className="fgl-signature">
      <div className="fgl-sign-pad">
        {saved && status === 'saved' && !dirty.current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={saved.url} alt="Your signature" className="fgl-sign-img" />
        ) : null}
        <canvas
          ref={canvas}
          id={inputId}
          role="img"
          aria-label="Signature pad — draw with your mouse, finger or stylus"
          aria-describedby={describedBy}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
            if (status === 'saved') {
              clear();
            }
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = pos(e);
            const g = canvas.current!.getContext('2d')!;
            const dt = Math.max(1, p.t - last.current.t);
            const speed = Math.hypot(p.x - last.current.x, p.y - last.current.y) / dt;
            g.strokeStyle = ink.trim() || '#2b2320';
            g.lineWidth = Math.max(1.1, 3.2 - speed * 1.6) * (e.pressure > 0 && e.pointerType === 'pen' ? 0.6 + e.pressure : 1);
            g.beginPath();
            g.moveTo(last.current.x, last.current.y);
            g.lineTo(p.x, p.y);
            g.stroke();
            last.current = p;
            dirty.current = true;
            if (status !== 'drawn') setStatus('drawn');
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
            void save();
          }}
        />
        <span className="fgl-sign-line" aria-hidden>
          ✕
        </span>
      </div>
      <div className="fgl-sign-bar">
        <span className="fgl-hint-text" aria-live="polite">
          {status === 'empty' ? 'Sign above' : status === 'saving' ? 'Saving…' : status === 'saved' ? 'Signed ✓' : status === 'error' ? 'Couldn’t save, try again' : ''}
        </span>
        <button type="button" className="fgl-linkish" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}
