"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveFlyoverManifestUrl,
  type FlyoverFrameSequence,
} from "@/lib/flyover-frames";
import {
  beginFrameSequencePreload,
  type FrameSequenceHandle,
} from "@/lib/frame-sequence/preloader";

type UseFrameSequenceOptions = {
  frames?: FlyoverFrameSequence | null;
  /** Used to resolve manifest at /frames/{playbackId}/manifest.json */
  videoSrc?: string;
  enabled?: boolean;
};

type UseFrameSequenceResult = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  loadedCount: number;
  frameCount: number;
  manifestUrl: string | null;
  getFrame: (index: number) => ImageBitmap | null;
};

export function useFrameSequence({
  frames,
  videoSrc,
  enabled = true,
}: UseFrameSequenceOptions): UseFrameSequenceResult {
  const handleRef = useRef<FrameSequenceHandle | null>(null);
  const manifestUrl = resolveFlyoverManifestUrl(frames, videoSrc);
  const [state, setState] = useState<UseFrameSequenceResult>({
    ready: false,
    loading: false,
    error: null,
    loadedCount: 0,
    frameCount: 0,
    manifestUrl,
    getFrame: () => null,
  });

  useEffect(() => {
    if (!enabled || !manifestUrl) {
      handleRef.current?.dispose();
      handleRef.current = null;
      setState({
        ready: false,
        loading: false,
        error: null,
        loadedCount: 0,
        frameCount: 0,
        manifestUrl,
        getFrame: () => null,
      });
      return;
    }

    let cancelled = false;
    handleRef.current?.dispose();
    handleRef.current = null;

    setState({
      ready: false,
      loading: true,
      error: null,
      loadedCount: 0,
      frameCount: 0,
      manifestUrl,
      getFrame: () => null,
    });

    beginFrameSequencePreload(manifestUrl, (loaded, total) => {
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        ready: loaded > 0,
        loading: loaded < total,
        loadedCount: loaded,
        frameCount: total,
        getFrame: (index) => handleRef.current?.getFrame(index) ?? null,
      }));
    })
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }

        handleRef.current = handle;
        setState({
          ready: handle.loadedCount > 0,
          loading: handle.loadedCount < handle.frameCount,
          error: null,
          loadedCount: handle.loadedCount,
          frameCount: handle.frameCount,
          manifestUrl,
          getFrame: (index) => handle.getFrame(index),
        });

        return handle.loadPromise.then(() => {
          if (cancelled) return;
          if (process.env.NODE_ENV === "development") {
            console.info(
              `[ScrollyVideoSection] Frame sequence ready (${handle.frameCount} frames)`,
              manifestUrl,
            );
          }
          setState({
            ready: true,
            loading: false,
            error: null,
            loadedCount: handle.frameCount,
            frameCount: handle.frameCount,
            manifestUrl,
            getFrame: (index) => handle.getFrame(index),
          });
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Frame preload failed";
        console.warn(
          "[ScrollyVideoSection] Frame preload failed; using video fallback.",
          message,
          manifestUrl,
        );
        setState({
          ready: false,
          loading: false,
          error: message,
          loadedCount: 0,
          frameCount: 0,
          manifestUrl,
          getFrame: () => null,
        });
      });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [enabled, manifestUrl]);

  return state;
}
