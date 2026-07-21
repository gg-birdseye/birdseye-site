"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Hls from "hls.js";
import { SCROLLY_VIDEO_FADE_START, seekVideoForScrub } from "@/lib/scrolly-video";
import { progressToLoadedFrameIndex, type FlyoverFrameSequence } from "@/lib/flyover-frames";
import {
  drawCoverFrame,
  resizeCanvasToDisplaySize,
} from "@/lib/frame-sequence/canvas-draw";
import { useFrameSequence } from "@/hooks/useFrameSequence";
import { ScrollFlyHint } from "@/components/ScrollFlyHint";
import { CourseFullscreenButton } from "@/components/CourseFullscreenButton";

const SCROLL_HINT_DISMISS_PX = 120;

type HeroVariant = "default" | "coursePreview";

type Props = {
  /** Progressive MP4 / HLS fallback while frames load or when no frame sequence exists. */
  src: string;
  /** Used when `src` fails (e.g. Mux asset missing static MP4). Typically HLS. */
  fallbackSrc?: string;
  poster?: string;
  /** Pre-generated frame sequence for canvas scroll-scrub (preferred when ready). */
  frames?: FlyoverFrameSequence;
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  /** When `coursePreview`, shows large hole index and scroll hint instead of marketing headline. */
  heroVariant?: HeroVariant;
  /** Hole index shown in course hero (e.g. 0 before flyover, 1–18). */
  courseHoleIndex?: number;
  /** Accent for course-preview hole number (e.g. course brand orange). */
  accentColor?: string;
  scrollFlyLabel?: string;
  /** Fired with scroll-scrub progress 0–1 for tying UI (hole chips, etc.) to the flyover. */
  onScrubProgress?: (progress01: number) => void;
  /** Fired with actual video playback position 0–1 (preferred for progress bars). */
  onVideoProgress?: (progress01: number) => void;
  /** When true, skip the end-of-scroll color overlay (e.g. homepage uses HomeClientsSection). */
  disableEndOverlay?: boolean;
  /** When true, hide intro/outro overlays — bare video scrub only (course pages). */
  disableScrollOverlays?: boolean;
  /** When true with disableScrollOverlays, show SCROLL TO FLY hint with animated arrows. */
  showScrollHint?: boolean;
  /** Bumps when the user jumps to a new hole — re-shows the hint and restarts its animation. */
  scrollHintKey?: number;
  /** Called after the hint fades out on the current hole. */
  onScrollHintDismiss?: () => void;
  /** Rendered below the video on mobile (e.g. course nav buttons). */
  mobileFooter?: ReactNode;
  /** Overlays on the video on mobile (e.g. hole nav, quality toggle). */
  mobileVideoChrome?: ReactNode;
  /** Course pages: show expand/compress control on the video stage. */
  showFullscreenButton?: boolean;
};

type HlsAttach = {
  detach: () => void;
  hls: Hls | null;
};

function attachHlsOrSrc(video: HTMLVideoElement, src: string): HlsAttach {
  const isRemote = /^https?:\/\//i.test(src);
  if (isRemote) {
    video.crossOrigin = "anonymous";
  } else {
    video.removeAttribute("crossOrigin");
  }

  const isHls = /\.m3u8(\?|$)/i.test(src);
  let hls: Hls | null = null;

  if (isHls) {
    const canNative =
      video.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (canNative) {
      video.src = src;
    } else if (Hls.isSupported()) {
      // Worker builds can fail silently in some dev/CSP setups; Mux is fine without it.
      hls = new Hls({ enableWorker: false });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
  } else {
    video.src = src;
  }

  const detach = () => {
    hls?.destroy();
    hls = null;
    video.removeAttribute("src");
    video.load();
  };

  return { detach, hls };
}

export function ScrollyVideoSection({
  src,
  fallbackSrc,
  poster,
  frames,
  eyebrow = "",
  headline = "Bring the Course to Life",
  subhead = "Aerial course footage made interactive for golfers to preview before they arrive - so each first tee feels familiar.",
  heroVariant = "default",
  courseHoleIndex = 0,
  accentColor = "#CF8018",
  scrollFlyLabel = "SCROLL TO FLY",
  onScrubProgress,
  onVideoProgress,
  disableEndOverlay = false,
  disableScrollOverlays = false,
  showScrollHint = false,
  scrollHintKey = 0,
  onScrollHintDismiss,
  mobileFooter,
  mobileVideoChrome,
  showFullscreenButton = false,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScrubProgressRef = useRef(onScrubProgress);
  onScrubProgressRef.current = onScrubProgress;
  const onVideoProgressRef = useRef(onVideoProgress);
  onVideoProgressRef.current = onVideoProgress;
  const onScrollHintDismissRef = useRef(onScrollHintDismiss);
  onScrollHintDismissRef.current = onScrollHintDismiss;
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayPanelRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const scrollHintDismissedRef = useRef(false);
  const endSectionOverlayRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState(showScrollHint);
  const capturedSrcForStillRef = useRef<string | null>(null);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
  const [videoPaintReady, setVideoPaintReady] = useState(false);
  const [playbackSrc, setPlaybackSrc] = useState(src);
  const triedFallbackRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getFrameRef = useRef<(index: number) => ImageBitmap | null>(() => null);
  const framePaintReadyRef = useRef(false);
  const [framePaintReady, setFramePaintReady] = useState(false);

  const frameSequence = useFrameSequence({
    frames,
    videoSrc: playbackSrc,
  });
  getFrameRef.current = frameSequence.getFrame;
  const useFrameScrub = frameSequence.ready;
  const frameManifestUrl = frameSequence.manifestUrl;
  const preferFrameScrub = Boolean(frameManifestUrl) && !frameSequence.error;
  const useVideoFallback = !useFrameScrub && (!preferFrameScrub || Boolean(frameSequence.error));

  const registered = useMemo(() => ({ current: false }), []);
  if (!registered.current) {
    gsap.registerPlugin(ScrollTrigger);
    registered.current = true;
  }

  useEffect(() => {
    if (!showScrollHint) {
      setHintVisible(false);
      scrollHintDismissedRef.current = true;
      return;
    }

    scrollHintDismissedRef.current = false;
    setHintVisible(true);
    const el = scrollHintRef.current;
    if (el) {
      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 1, y: 0 });
    }
  }, [showScrollHint, scrollHintKey]);

  const dismissScrollHint = useCallback(() => {
    if (scrollHintDismissedRef.current || !showScrollHint) return;
    scrollHintDismissedRef.current = true;

    const el = scrollHintRef.current;
    if (el) {
      gsap.to(el, {
        opacity: 0,
        y: -10,
        duration: 0.35,
        ease: "power2.out",
        onComplete: () => {
          setHintVisible(false);
          onScrollHintDismissRef.current?.();
        },
      });
      return;
    }

    setHintVisible(false);
    onScrollHintDismissRef.current?.();
  }, [showScrollHint]);

  useEffect(() => {
    triedFallbackRef.current = false;
    setPlaybackSrc(src);
  }, [src, fallbackSrc]);

  useEffect(() => {
    setFirstFrameUrl(null);
    setVideoPaintReady(false);
    framePaintReadyRef.current = false;
    setFramePaintReady(false);
    capturedSrcForStillRef.current = null;
  }, [playbackSrc, frames?.manifestUrl, frames?.version]);

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const overlayPanel = overlayPanelRef.current;
    if (!track || !canvas || !useFrameScrub || frameSequence.frameCount < 1) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let trigger: ScrollTrigger | null = null;
    let overlayTween: gsap.core.Tween | null = null;
    let overlayPanelTween: gsap.core.Tween | null = null;

    const copyExitScrollPx = 600;
    const overlayFadeScrollPx = 360;

    if (overlay && !disableScrollOverlays) {
      overlayTween = gsap.to(overlay, {
        yPercent: -60,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: `top+=${copyExitScrollPx}px top`,
          scrub: true,
        },
      });
    }

    if (overlayPanel && !disableScrollOverlays) {
      gsap.set(overlayPanel, { opacity: 0.6 });
      overlayPanelTween = gsap.to(overlayPanel, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: `top+=${overlayFadeScrollPx}px top`,
          scrub: true,
        },
      });
    }

    const drawAtProgress = (p: number) => {
      const { width, height } = resizeCanvasToDisplaySize(canvas);
      const index = progressToLoadedFrameIndex(
        p,
        frameSequence.frameCount,
        frameSequence.loadedCount,
      );
      const bitmap = getFrameRef.current(index);
      if (!bitmap) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      drawCoverFrame(ctx, bitmap, width, height);
      if (!framePaintReadyRef.current) {
        framePaintReadyRef.current = true;
        setFramePaintReady(true);
      }
    };

    trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (showScrollHint && self.scroll() > SCROLL_HINT_DISMISS_PX) {
          dismissScrollHint();
        }
        onScrubProgressRef.current?.(p);
        drawAtProgress(p);
        onVideoProgressRef.current?.(p);

        const green = endSectionOverlayRef.current;
        if (green && !disableEndOverlay) {
          const fadeStart = SCROLLY_VIDEO_FADE_START;
          const o = p <= fadeStart ? 0 : (p - fadeStart) / (1 - fadeStart);
          green.style.opacity = String(Math.min(1, Math.max(0, o)));
        } else if (green) {
          green.style.opacity = "0";
        }
      },
    });

    trigger.update();
    drawAtProgress(trigger.progress);
    if (disableScrollOverlays && window.scrollY < 2) {
      onScrubProgressRef.current?.(0);
      onVideoProgressRef.current?.(0);
    }
    ScrollTrigger.refresh();

    const onResize = () => {
      ScrollTrigger.refresh();
      if (trigger) drawAtProgress(trigger.progress);
    };
    window.addEventListener("resize", onResize);

    const canvasParent = canvas.parentElement;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && canvasParent
        ? new ResizeObserver(() => {
            if (trigger) drawAtProgress(trigger.progress);
          })
        : null;
    if (canvasParent) {
      resizeObserver?.observe(canvasParent);
    }

    const onScroll = () => {
      if (!showScrollHint || scrollHintDismissedRef.current) return;
      if (window.scrollY > SCROLL_HINT_DISMISS_PX) dismissScrollHint();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      trigger?.kill();
      overlayTween?.scrollTrigger?.kill();
      overlayTween?.kill();
      overlayPanelTween?.scrollTrigger?.kill();
      overlayPanelTween?.kill();
    };
  }, [
    useFrameScrub,
    frameSequence.frameCount,
    frameSequence.loadedCount,
    disableEndOverlay,
    disableScrollOverlays,
    showScrollHint,
    dismissScrollHint,
  ]);

  useEffect(() => {
    const track = trackRef.current;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const overlayPanel = overlayPanelRef.current;
    if (!track || !video || !playbackSrc || !useVideoFallback) return;

    const { detach: detachSrc, hls } = attachHlsOrSrc(video, playbackSrc);

    const tryFallback = () => {
      if (
        triedFallbackRef.current ||
        !fallbackSrc ||
        playbackSrc === fallbackSrc
      ) {
        return;
      }
      triedFallbackRef.current = true;
      console.warn(
        "[ScrollyVideoSection] Primary video failed; falling back to stream.",
        playbackSrc,
      );
      setPlaybackSrc(fallbackSrc);
    };

    let trigger: ScrollTrigger | null = null;
    let overlayTween: gsap.core.Tween | null = null;
    let overlayPanelTween: gsap.core.Tween | null = null;
    let rafId: number | null = null;
    let pendingTime = 0;
    const objectUrlToRevoke: string | null = null;
    const setVideoTime = (t: number) => {
      pendingTime = t;
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        seekVideoForScrub(video, pendingTime);
        const duration = video.duration;
        if (duration && Number.isFinite(duration) && duration > 0) {
          onVideoProgressRef.current?.(
            Math.min(1, Math.max(0, pendingTime / duration)),
          );
        }
      });
    };

    const reportVideoProgress = () => {
      const duration = video.duration;
      if (!duration || !Number.isFinite(duration) || duration <= 0) return;
      onVideoProgressRef.current?.(
        Math.min(1, Math.max(0, video.currentTime / duration)),
      );
    };

    const copyExitScrollPx = 600;
    const overlayFadeScrollPx = 360;

    if (overlay && !disableScrollOverlays) {
      overlayTween = gsap.to(overlay, {
        yPercent: -60,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: `top+=${copyExitScrollPx}px top`,
          scrub: true,
        },
      });
    }

    if (overlayPanel && !disableScrollOverlays) {
      gsap.set(overlayPanel, { opacity: 0.6 });
      overlayPanelTween = gsap.to(overlayPanel, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: track,
          start: "top top",
          end: `top+=${overlayFadeScrollPx}px top`,
          scrub: true,
        },
      });
    }

    const init = () => {
      const duration = video.duration;
      if (!duration || !Number.isFinite(duration)) return;

      trigger?.kill();
      trigger = ScrollTrigger.create({
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          if (showScrollHint && self.scroll() > SCROLL_HINT_DISMISS_PX) {
            dismissScrollHint();
          }
          onScrubProgressRef.current?.(p);
          const nextTime = p * duration;
          if (!Number.isFinite(nextTime)) return;
          setVideoTime(
            Math.min(Math.max(nextTime, 0), Math.max(duration - 0.001, 0)),
          );

          const green = endSectionOverlayRef.current;
          if (green && !disableEndOverlay) {
            const fadeStart = SCROLLY_VIDEO_FADE_START;
            const o = p <= fadeStart ? 0 : (p - fadeStart) / (1 - fadeStart);
            green.style.opacity = String(Math.min(1, Math.max(0, o)));
          } else if (green) {
            green.style.opacity = "0";
          }
        },
      });

      trigger.update();
      if (disableScrollOverlays && window.scrollY < 2) {
        setVideoTime(0);
        onScrubProgressRef.current?.(0);
        onVideoProgressRef.current?.(0);
      }
      ScrollTrigger.refresh();
      requestAnimationFrame(() => {
        trigger?.update();
        if (disableScrollOverlays && window.scrollY < 2) {
          setVideoTime(0);
          onScrubProgressRef.current?.(0);
          onVideoProgressRef.current?.(0);
        }
        ScrollTrigger.refresh();
      });
    };

    const tryInit = () => init();

    const revealVideo = () => setVideoPaintReady(true);

    const captureStillIfNeeded = () => {
      if (capturedSrcForStillRef.current === playbackSrc) return;
      capturedSrcForStillRef.current = playbackSrc;
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setFirstFrameUrl(dataUrl);
      } catch {
        // CORS or tainted canvas — poster / black still works
      }
    };

    const onLoadedMetadata = () => {
      tryInit();
      revealVideo();
    };

    const onDurationChange = () => tryInit();

    const onFirstFrame = () => {
      revealVideo();
      captureStillIfNeeded();
    };

    if (hls) {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        revealVideo();
        window.requestAnimationFrame(() => {
          tryInit();
          if (video.readyState >= 2) {
            captureStillIfNeeded();
          }
        });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn("[ScrollyVideoSection] HLS fatal error", data);
          tryFallback();
        }
      });
    }

    video.addEventListener("error", tryFallback);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("seeked", reportVideoProgress);
    video.addEventListener("canplay", revealVideo, { once: true });
    video.addEventListener("playing", revealVideo, { once: true });
    video.pause();

    if (video.readyState >= 1) {
      onLoadedMetadata();
    }

    if (video.readyState >= 2) {
      onFirstFrame();
    } else {
      video.addEventListener("loadeddata", onFirstFrame, { once: true });
    }

    const onScroll = () => {
      if (!showScrollHint || scrollHintDismissedRef.current) return;
      if (window.scrollY > SCROLL_HINT_DISMISS_PX) {
        dismissScrollHint();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      video.removeEventListener("error", tryFallback);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("seeked", reportVideoProgress);
      video.removeEventListener("loadeddata", onFirstFrame);
      trigger?.kill();
      overlayTween?.scrollTrigger?.kill();
      overlayTween?.kill();
      overlayPanelTween?.scrollTrigger?.kill();
      overlayPanelTween?.kill();
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      detachSrc();
    };
  }, [
    playbackSrc,
    fallbackSrc,
    disableEndOverlay,
    disableScrollOverlays,
    showScrollHint,
    dismissScrollHint,
    useVideoFallback,
  ]);

  return (
    <section className="relative">
      {!disableScrollOverlays ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(54,148,92,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 20%, rgba(34,95,61,0.25), transparent)",
          }}
        />
      ) : null}

      <div ref={trackRef} data-scrolly-track className="relative h-[300vh]">
        <div
          className={`sticky top-0 overflow-hidden bg-black ${
            mobileFooter ? "h-[100svh] course-mobile-sticky" : "scrolly-hero-sticky"
          }`}
        >
          {mobileFooter ? (
            <>
              <div className="course-mobile-nav pointer-events-auto flex min-h-0 flex-col overflow-hidden bg-[#1a1814]">
                {mobileFooter}
              </div>
              <div className="course-mobile-footer-spacer" aria-hidden />
            </>
          ) : null}

          <div
            className={`course-mobile-video-stage relative w-full overflow-hidden bg-black bg-cover bg-center ${
              mobileFooter
                ? "scrolly-video-stage-mobile md:h-full md:min-h-0 md:flex-1"
                : "h-full"
            }`}
            data-course-video-stage
            style={{
              backgroundImage: firstFrameUrl
                ? `url(${firstFrameUrl})`
                : poster
                  ? `url(${poster})`
                  : undefined,
            }}
          >
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
                useFrameScrub && framePaintReady
                  ? "opacity-100"
                  : preferFrameScrub && frameSequence.loading
                    ? "opacity-0"
                    : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={!useFrameScrub}
            />

            {preferFrameScrub && frameSequence.loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[30] flex justify-center">
                <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">
                  Loading flyover frames…
                </span>
              </div>
            ) : null}

            {useVideoFallback ? (
              <video
                key={playbackSrc}
                ref={videoRef}
                className={`transition-opacity duration-300 ${
                  mobileFooter ? "scrolly-video-course" : "scrolly-video-cover"
                } ${videoPaintReady ? "opacity-100" : "opacity-0"}`}
                muted
                playsInline
                preload="auto"
                poster={poster}
                aria-label="Scroll-bound course preview video"
              />
            ) : null}

            {!disableScrollOverlays ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent md:h-52"
                aria-hidden
              />
            ) : null}

            {!disableScrollOverlays ? (
              <div
                ref={overlayPanelRef}
                className="pointer-events-none absolute inset-0 bg-[var(--surface-elevated)] opacity-60"
                aria-hidden
              />
            ) : null}

            {!disableScrollOverlays ? (
              <div
                ref={endSectionOverlayRef}
                className="pointer-events-none absolute inset-0 z-[12]"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  opacity: 0,
                }}
                aria-hidden
              />
            ) : null}

            {!disableScrollOverlays ? (
              <div
                ref={overlayRef}
                className="absolute inset-0 z-[20] flex items-center justify-center px-4"
              >
                <div className="mx-auto w-full max-w-6xl text-center">
                  <div className="relative mx-auto w-full max-w-5xl px-6 py-10 md:px-12 md:py-14">
                    {heroVariant === "coursePreview" ? (
                      <>
                        <p
                          className="mb-1 font-serif text-[clamp(5rem,18vw,11rem)] font-bold leading-none tabular-nums tracking-[-0.04em]"
                          style={{ color: accentColor }}
                        >
                          # {courseHoleIndex}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-[0.45em] text-white/75 md:text-xs">
                          {scrollFlyLabel}
                        </p>
                      </>
                    ) : (
                      <>
                        {eyebrow ? (
                          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-birdseye-300 md:text-sm">
                            {eyebrow}
                          </p>
                        ) : null}
                        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
                          {headline}
                        </h1>
                        <p className="mx-auto mt-6 max-w-4xl text-xl leading-relaxed text-stone-200 md:text-2xl">
                          {subhead}
                        </p>
                        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                          <a
                            href="/courses/example-course"
                            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
                          >
                            Try it out
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {disableScrollOverlays && hintVisible && showScrollHint ? (
              <div
                ref={scrollHintRef}
                className="pointer-events-none absolute inset-0 z-[20] flex items-center justify-center px-4"
              >
                <ScrollFlyHint key={scrollHintKey} label={scrollFlyLabel} />
              </div>
            ) : null}

            {mobileVideoChrome ? (
              <div className="course-mobile-video-chrome pointer-events-none absolute inset-0 z-[25]">
                {mobileVideoChrome}
              </div>
            ) : null}

            {showFullscreenButton ? <CourseFullscreenButton /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
