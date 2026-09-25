/// <reference lib="webworker" />
/* The bake worker: paints procedural textures off the main thread and caches them. */
import { cacheGet, cachePut } from './cache';
import { JOBS, type JobName } from './jobs';
import { bitmapOpts, pack, type Source } from './pack';

interface Req {
  id: number;
  job: JobName;
  args: Record<string, unknown>;
  key: string | null;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const { id, job, args, key } = e.data;
  try {
    if (key) {
      const hit = await cacheGet(key);
      if (hit) {
        const bitmaps = await Promise.all(hit.blobs.map((b, i) => createImageBitmap(b, bitmapOpts(hit.flips[i]))));
        ctx.postMessage({ id, ok: true, packed: hit.packed, bitmaps, cached: true }, bitmaps);
        return;
      }
    }
    const fn = JOBS[job] as (a: unknown) => unknown;
    const result = fn(args);
    const sources: Source[] = [];
    const packed = pack(result, sources);
    const bitmaps = await Promise.all(sources.map((s) => createImageBitmap(s.canvas, bitmapOpts(s.flip))));
    ctx.postMessage({ id, ok: true, packed, bitmaps, cached: false }, bitmaps);
    // persist after replying: encoding PNGs is slow-ish but no one is waiting on it
    if (key) {
      const blobs = await Promise.all(sources.map((s) => (s.canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })));
      await cachePut(key, { packed, blobs, flips: sources.map((s) => s.flip), at: Date.now() });
    }
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: (err as Error)?.message ?? String(err) });
  }
};
