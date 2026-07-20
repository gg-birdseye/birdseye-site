import {
  fetchFrameManifest,
  frameUrl,
  type FrameManifest,
} from "@/lib/flyover-frames";

export type FrameSequenceHandle = {
  getFrame: (index: number) => ImageBitmap | null;
  frameCount: number;
  loadedCount: number;
  manifest: FrameManifest;
  dispose: () => void;
  loadPromise: Promise<void>;
};

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frame fetch failed (${res.status}): ${url}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/**
 * Begin loading a clip's frames. Returns as soon as the manifest is ready so
 * callers can scrub through frames as they arrive.
 */
export async function beginFrameSequencePreload(
  manifestUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<FrameSequenceHandle> {
  const manifest = await fetchFrameManifest(manifestUrl);
  const total = manifest.frameCount;
  const frames: (ImageBitmap | null)[] = new Array(total).fill(null);
  let loadedCount = 0;
  let disposed = false;
  const concurrency = 10;

  const getFrame = (index: number) => {
    if (disposed || index < 0 || index >= total) return null;
    return frames[index] ?? null;
  };

  const dispose = () => {
    disposed = true;
    for (const bitmap of frames) {
      bitmap?.close();
    }
  };

  const loadPromise = new Promise<void>((resolve, reject) => {
    queueMicrotask(async () => {
      try {
        frames[0] = await loadBitmap(frameUrl(manifest, 0));
        if (disposed) return;
        loadedCount = 1;
        onProgress?.(1, total);

        for (let start = 1; start < total; start += concurrency) {
          if (disposed) return;
          const end = Math.min(start + concurrency, total);
          await Promise.all(
            Array.from({ length: end - start }, (_, offset) => {
              const index = start + offset;
              return loadBitmap(frameUrl(manifest, index)).then((bitmap) => {
                if (disposed) return;
                frames[index] = bitmap;
                loadedCount++;
                onProgress?.(loadedCount, total);
              });
            }),
          );
        }

        if (!disposed) resolve();
      } catch (error) {
        if (!disposed) reject(error);
      }
    });
  });

  return {
    manifest,
    frameCount: total,
    get loadedCount() {
      return loadedCount;
    },
    getFrame,
    dispose,
    loadPromise,
  };
}

/**
 * Preload every frame for a clip into ImageBitmaps (best scroll-scrub smoothness).
 */
export async function preloadFrameSequence(
  manifestUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<FrameSequenceHandle> {
  const handle = await beginFrameSequencePreload(manifestUrl, onProgress);
  await handle.loadPromise;
  return handle;
}
