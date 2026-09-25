'use client';
/*
 * Main-thread side of the bake system. Jobs are spread over a small worker pool; if workers
 * or OffscreenCanvas are unavailable they run here instead, one per frame, so the loading
 * screen keeps moving either way.
 */
import { BAKE_VERSION, JOBS, type JobArgs, type JobName, type JobResult } from './jobs';
import { unpack, type Packed } from './pack';

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

let pool: Worker[] | null = null;
let rr = 0;
let seq = 0;
const pending = new Map<number, Pending>();
let workersBroken = false;

function supported() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined' && !workersBroken;
}

function getPool(): Worker[] | null {
  if (!supported()) return null;
  if (pool) return pool;
  try {
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 2));
    pool = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module', name: 'formgl-bake' });
      w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; packed?: Packed; bitmaps?: ImageBitmap[]; error?: string }>) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.ok) p.resolve(unpack(e.data.packed!, e.data.bitmaps ?? []));
        else p.reject(new Error(e.data.error || 'bake failed'));
      };
      w.onerror = (ev) => {
        ev.preventDefault?.();
        workersBroken = true;
        for (const [id, p] of pending) {
          pending.delete(id);
          p.reject(new Error('bake worker crashed'));
        }
      };
      return w;
    });
    return pool;
  } catch {
    workersBroken = true;
    return null;
  }
}

const nextFrame = () => new Promise<void>((r) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));

/** run the job on this thread — used when workers are unavailable */
async function local<K extends JobName>(job: K, args: JobArgs<K>): Promise<JobResult<K>> {
  await nextFrame();
  return (JOBS[job] as (a: unknown) => unknown)(args) as JobResult<K>;
}

/**
 * Bake a texture set. `cacheKey` overrides the automatic key (needed when args hold bitmaps);
 * pass `false` to skip the persistent cache.
 */
export async function bake<K extends JobName>(job: K, args: JobArgs<K>, cacheKey?: string | false): Promise<JobResult<K>> {
  const workers = getPool();
  if (!workers) return local(job, args);
  const key = cacheKey === false ? null : `${BAKE_VERSION}:${job}:${cacheKey ?? JSON.stringify(args ?? {})}`;
  const id = ++seq;
  const w = workers[rr++ % workers.length];
  const transfer = Object.values((args ?? {}) as Record<string, unknown>).filter((v): v is ImageBitmap => typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap);
  try {
    return await new Promise<JobResult<K>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, job, args: args ?? {}, key }, transfer);
    });
  } catch (e) {
    // a worker failed: fall back to baking here (bitmaps in args were transferred — rebuild is the caller's job)
    if (transfer.length) throw e;
    return local(job, args);
  }
}

/** warm the pool early (spawning workers and loading their code takes a moment) */
export function prewarmBakers() {
  getPool();
}
