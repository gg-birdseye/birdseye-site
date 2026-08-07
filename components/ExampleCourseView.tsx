"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CourseMenuButton } from "@/components/CourseMenuButton";
import { HoleSelectorOverlay } from "@/components/HoleSelectorOverlay";
import { ExampleCourseLogo } from "@/components/ExampleCourseLogo";
import { AerialPanelOverlay } from "@/components/AerialPanelOverlay";
import { HoleGraphicPanel } from "@/components/HoleGraphicPanel";
import { CoursePanelOverlay } from "@/components/CoursePanelOverlay";
import { ScorecardChartOverlay, type ScorecardChartTee } from "@/components/ScorecardChartOverlay";
import {
  ScorecardMobileDataOverlay,
  type ScorecardMobileTee,
} from "@/components/ScorecardMobileDataOverlay";
import { ScrollyVideoSection } from "@/components/ScrollyVideoSection";
import {
  scorecardDisplayTotalPar,
  scorecardHasGenderChartDifferences,
  scorecardParsForGender,
  scorecardTeeForGender,
  type CourseAerialMapData,
  type CourseContactInfo,
  type CourseHoleDescriptions,
  type CoursePagePanels,
  type RelatedCourseLink,
  type CourseScorecardData,
  type HoleGraphic,
  type HoleGraphicEntry,
  type CameraPathPoint,
  type YardageArcsData,
  type YardageArcRender,
  type HolePlayback,
  type ScorecardGender,
} from "@/lib/sanity/courses";
import { holeLocalScrollProgress, holeStartProgress, holeToProgress, scrollTrackToProgress } from "@/lib/scrolly-video";
import { resolveTeeColor } from "@/lib/constants/teeColors";
import {
  DEMO_ACCENT,
  DEMO_COURSE_INFO,
  DEMO_HOLE_HDCP,
  DEMO_HOLE_INFO,
  DEMO_HOLE_PAR,
  DEMO_YARDAGES,
  TEE_COLORS,
  TEE_YARDAGES,
} from "@/lib/demo/example-course";

const ALT_TICKS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const;

function holeList(count: number) {
  return Array.from({ length: count }, (_, i) => i + 1);
}

/** Map scroll-scrub progress to intro (0) or hole 1–N. */
function progressToHole(p: number, totalHoles: number): number {
  if (p < 0.045) return 0;
  const t = (p - 0.045) / (1 - 0.045);
  return Math.min(totalHoles, 1 + Math.floor(t * totalHoles));
}

const DEFAULT_VIDEO = "/testflyover1.mp4";
const DEFAULT_POSTER =
  "https://images.unsplash.com/photo-1587174486079-aece005fc2c7?auto=format&fit=crop&w=1920&q=80";

const DEFAULT_PAGE_PANELS: Required<CoursePagePanels> = {
  aerial: true,
  courses: true,
  bookTeeTime: false,
  bookTeeTimeUrl: null,
  courseCount: 2,
  courseSelections: [],
};

const DEMO_COURSE_OPTIONS = [
  "Coastal Dunes",
  "Pacific Bluffs",
  "Cypress Trails",
  "Highland Meadows",
  "Sheepgate Ranch",
  "The Preserve",
  "The Short Course",
] as const;

const PANEL_NAV_ITEMS = [
  { id: "scorecard" as const, label: "Scorecard" },
  { id: "map" as const, label: "Aerial", panelKey: "aerial" as const },
  { id: "courses" as const, label: "Course", panelKey: "courses" as const },
];

function formatTotalYardsFromHoles(
  yardages: ReadonlyArray<string | number>,
  holeCount: number,
): string {
  let sum = 0;
  let hasValue = false;
  for (let hole = 1; hole <= holeCount; hole += 1) {
    const raw = yardages[hole];
    const value =
      typeof raw === "number"
        ? raw
        : Number.parseFloat(String(raw ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(value)) {
      sum += value;
      hasValue = true;
    }
  }
  return hasValue ? String(sum) : "—";
}

export type ExampleCourseViewProps = {
  courseTitle?: string;
  videoSrc?: string;
  fallbackVideoSrc?: string;
  posterUrl?: string;
  accentColor?: string;
  holeCount?: number;
  /** Per-hole Mux flyovers from Sanity — each hole gets its own scroll-scrub clip. */
  holeVideos?: HolePlayback[];
  /** When true, show the example-course demo scorecard and hole copy. */
  demoScorecard?: boolean;
  /** Hide CoursePreview branding, left hole-map image, and yardage scale. */
  hideLegacyChrome?: boolean;
  /** Square course logo shown on the video player (bottom-left). */
  videoLogoSrc?: string;
  /** Which footer/nav panel buttons are shown. Defaults to all on for demo pages. */
  pagePanels?: CoursePagePanels;
  /** Per-hole yardages and handicaps from Sanity (1-indexed arrays). */
  scorecardData?: CourseScorecardData;
  /** Aerial routing map from Sanity (image or WebM). */
  aerialMap?: CourseAerialMapData;
  /** Per-hole layout graphics from Sanity (SVG/PNG/WebP). */
  holeGraphics?: HoleGraphicEntry[];
  /** Address + phone for the video menu. */
  contact?: CourseContactInfo;
  /** Sanity hole blurbs keyed by hole number. */
  holeDescriptions?: CourseHoleDescriptions;
};

export function ExampleCourseView({
  courseTitle = "Example Course",
  videoSrc = DEFAULT_VIDEO,
  fallbackVideoSrc,
  posterUrl = DEFAULT_POSTER,
  accentColor = DEMO_ACCENT,
  holeCount = 18,
  holeVideos = [],
  demoScorecard = false,
  hideLegacyChrome = true,
  videoLogoSrc,
  pagePanels: pagePanelsProp,
  scorecardData,
  aerialMap,
  holeGraphics: holeGraphicsProp,
  contact,
  holeDescriptions: holeDescriptionsProp,
}: ExampleCourseViewProps = {}) {
  const pagePanels = useMemo(
    () => ({
      aerial: pagePanelsProp?.aerial ?? DEFAULT_PAGE_PANELS.aerial,
      courses: pagePanelsProp?.courses ?? DEFAULT_PAGE_PANELS.courses,
      bookTeeTime: pagePanelsProp?.bookTeeTime ?? DEFAULT_PAGE_PANELS.bookTeeTime,
      bookTeeTimeUrl:
        pagePanelsProp?.bookTeeTimeUrl ?? DEFAULT_PAGE_PANELS.bookTeeTimeUrl,
      courseCount: pagePanelsProp?.courseCount ?? DEFAULT_PAGE_PANELS.courseCount,
      courseSelections:
        pagePanelsProp?.courseSelections ?? DEFAULT_PAGE_PANELS.courseSelections,
    }),
    [pagePanelsProp],
  );
  const coursePanelButtons = useMemo((): RelatedCourseLink[] => {
    const selections = pagePanels.courseSelections ?? [];
    if (selections.length > 0) {
      return selections;
    }
    if (demoScorecard) {
      return DEMO_COURSE_OPTIONS.map((title) => ({ title, slug: null }));
    }
    return [];
  }, [demoScorecard, pagePanels.courseSelections]);
  const holes = useMemo(() => holeList(holeCount), [holeCount]);
  const perHoleMode = holeVideos.length > 0;
  const holeVideoMap = useMemo(
    () => new Map(holeVideos.map((h) => [h.holeNumber, h])),
    [holeVideos],
  );
  const holeGraphicMap = useMemo(() => {
    const map = new Map<number, HoleGraphic>();
    for (const entry of holeGraphicsProp ?? []) {
      map.set(entry.holeNumber, entry.graphic);
    }
    for (const hole of holeVideos) {
      if (hole.holeGraphic && !map.has(hole.holeNumber)) {
        map.set(hole.holeNumber, hole.holeGraphic);
      }
    }
    return map;
  }, [holeGraphicsProp, holeVideos]);
  const cameraPathMap = useMemo(() => {
    const map = new Map<number, CameraPathPoint[]>();
    for (const entry of holeGraphicsProp ?? []) {
      if (entry.cameraPath?.length) {
        map.set(entry.holeNumber, entry.cameraPath);
      }
    }
    for (const hole of holeVideos) {
      if (hole.cameraPath?.length && !map.has(hole.holeNumber)) {
        map.set(hole.holeNumber, hole.cameraPath);
      }
    }
    return map;
  }, [holeGraphicsProp, holeVideos]);
  const yardageArcsMap = useMemo(() => {
    const map = new Map<number, YardageArcsData>();
    for (const entry of holeGraphicsProp ?? []) {
      if (entry.yardageArcs) {
        map.set(entry.holeNumber, entry.yardageArcs);
      }
    }
    for (const hole of holeVideos) {
      if (hole.yardageArcs && !map.has(hole.holeNumber)) {
        map.set(hole.holeNumber, hole.yardageArcs);
      }
    }
    return map;
  }, [holeGraphicsProp, holeVideos]);
  const yardageArcRenderMap = useMemo(() => {
    const map = new Map<number, YardageArcRender>();
    for (const entry of holeGraphicsProp ?? []) {
      if (entry.yardageArcRender) {
        map.set(entry.holeNumber, entry.yardageArcRender);
      }
    }
    return map;
  }, [holeGraphicsProp]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialHole = Math.min(
    holeCount,
    Math.max(0, Number.parseInt(searchParams.get("hole") ?? "1", 10) || 1),
  );

  const [selectedHole, setSelectedHole] = useState(initialHole === 0 ? 1 : initialHole);
  const [scrubHole, setScrubHole] = useState(initialHole === 0 ? 0 : initialHole);
  const [selectedTee, setSelectedTee] = useState(2);
  const [scorecardGender, setScorecardGender] = useState<ScorecardGender>("men");
  const [panelOpen, setPanelOpen] = useState<"scorecard" | "map" | "courses" | null>(
    null,
  );
  const [aerialViewMode, setAerialViewMode] = useState<"course" | "hole">("hole");
  const showScorecardGenderToggle = scorecardHasGenderChartDifferences(
    scorecardData,
  );
  const [holeDescOpen, setHoleDescOpen] = useState(false);
  const [scrollHintDismissed, setScrollHintDismissed] = useState(false);
  const [scrollHintKey, setScrollHintKey] = useState(0);
  const [flyoverProgress, setFlyoverProgress] = useState(0);
  const [isMobilePortrait, setIsMobilePortrait] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches,
  );
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px) and (min-height: 601px)").matches,
  );
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressWrapRef = useRef<HTMLDivElement>(null);
  const progressScrubbingRef = useRef(false);
  const activeHoleRef = useRef(1);
  const syncedFromUrl = useRef(false);

  const setBarProgress = useCallback((p: number) => {
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("hide-scroll-bar");
    return () => document.documentElement.classList.remove("hide-scroll-bar");
  }, []);

  useEffect(() => {
    const portraitMq = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    const desktopMq = window.matchMedia("(min-width: 768px) and (min-height: 601px)");
    const update = () => {
      setIsMobilePortrait(portraitMq.matches);
      setIsDesktopLayout(desktopMq.matches);
    };
    update();
    portraitMq.addEventListener("change", update);
    desktopMq.addEventListener("change", update);
    return () => {
      portraitMq.removeEventListener("change", update);
      desktopMq.removeEventListener("change", update);
    };
  }, []);

  // Portrait scorecard → landscape: return to video with left nav inactive.
  const wasMobilePortraitRef = useRef(isMobilePortrait);
  useEffect(() => {
    const wasPortrait = wasMobilePortraitRef.current;
    wasMobilePortraitRef.current = isMobilePortrait;
    if (wasPortrait && !isMobilePortrait && panelOpen === "scorecard") {
      setPanelOpen(null);
    }
  }, [isMobilePortrait, panelOpen]);

  const panelBlocksHoleSelector =
    panelOpen === "scorecard" ||
    panelOpen === "courses" ||
    (panelOpen === "map" && aerialViewMode === "course");

  const isAerialHoleViewOpen =
    panelOpen === "map" &&
    aerialViewMode === "hole" &&
    Boolean(pagePanels.aerial);

  // Mirror the hole-view class on <html> so portaled overlays (e.g. the hole
  // selector grid rendered into document.body) still match scoped CSS rules.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "course-aerial-hole-view-open",
      isAerialHoleViewOpen,
    );
    return () => {
      document.documentElement.classList.remove("course-aerial-hole-view-open");
    };
  }, [isAerialHoleViewOpen]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  const onVideoProgress = useCallback(
    (p: number) => {
      if (perHoleMode) {
        setBarProgress(p);
      }
    },
    [perHoleMode, setBarProgress],
  );

  const onScrubProgress = useCallback(
    (p: number) => {
      if (perHoleMode) {
        setFlyoverProgress(p);
        return;
      }

      const local = holeLocalScrollProgress(p, activeHoleRef.current, holeCount);
      setBarProgress(local);
      setFlyoverProgress(local);
      const nextHole = progressToHole(p, holeCount);
      setScrubHole((prev) => (prev === nextHole ? prev : nextHole));
    },
    [holeCount, perHoleMode, setBarProgress],
  );

  const goToFlyoverProgress = useCallback(
    (t: number, options?: { refresh?: boolean }) => {
      const clamped = Math.min(1, Math.max(0, t));
      if (perHoleMode) {
        scrollTrackToProgress(clamped, "instant", options);
      } else {
        const hole = activeHoleRef.current;
        const start = holeToProgress(hole, holeCount);
        const end = hole >= holeCount ? 1 : holeToProgress(hole + 1, holeCount);
        scrollTrackToProgress(start + clamped * (end - start), "instant", options);
      }
      setBarProgress(clamped);
      setFlyoverProgress(clamped);
    },
    [holeCount, perHoleMode, setBarProgress],
  );

  const progressFromClientX = useCallback((clientX: number) => {
    const wrap = progressWrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const onProgressPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      progressScrubbingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      goToFlyoverProgress(progressFromClientX(event.clientX), { refresh: false });
    },
    [goToFlyoverProgress, progressFromClientX],
  );

  const onProgressPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!progressScrubbingRef.current) return;
      event.preventDefault();
      goToFlyoverProgress(progressFromClientX(event.clientX), { refresh: false });
    },
    [goToFlyoverProgress, progressFromClientX],
  );

  const onProgressPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!progressScrubbingRef.current) return;
      progressScrubbingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      // One refresh after the scrub gesture settles.
      ScrollTrigger.refresh();
    },
    [],
  );

  const displayHole = perHoleMode ? selectedHole : scrubHole;
  const activeHole = Math.max(1, displayHole || 1);
  activeHoleRef.current = activeHole;

  const activePlayback = useMemo(() => {
    const holeClip = holeVideoMap.get(activeHole);
    if (holeClip) {
      return {
        videoSrc: holeClip.videoSrc,
        fallbackVideoSrc: holeClip.fallbackVideoSrc,
        posterUrl: holeClip.posterUrl,
        frames: holeClip.frames,
      };
    }
    return { videoSrc, fallbackVideoSrc, posterUrl, frames: null as HolePlayback["frames"] };
  }, [activeHole, holeVideoMap, videoSrc, fallbackVideoSrc, posterUrl]);

  const yardages = useMemo(() => {
    if (demoScorecard) return [...DEMO_YARDAGES];
    if (scorecardData) return scorecardData.yardages;
    return [0, ...holes.map((h) => 320 + ((h * 17) % 180))];
  }, [demoScorecard, scorecardData, holes]);

  const hdcp = useMemo(() => {
    if (demoScorecard) return [...DEMO_HOLE_HDCP];
    if (scorecardData?.tees[0]) {
      return scorecardTeeForGender(
        scorecardData.tees[0],
        showScorecardGenderToggle ? scorecardGender : "men",
      ).handicaps;
    }
    return [0, ...holes.map((h) => (h * 3) % 18 || 18)];
  }, [demoScorecard, scorecardData, holes, scorecardGender, showScorecardGenderToggle]);

  useEffect(() => {
    if (!showScorecardGenderToggle && scorecardGender !== "men") {
      setScorecardGender("men");
    }
  }, [showScorecardGenderToggle, scorecardGender]);

  const parsForGender = useMemo(() => {
    if (!scorecardData) return null;
    return scorecardParsForGender(
      scorecardData,
      showScorecardGenderToggle ? scorecardGender : "men",
      selectedTee,
    );
  }, [scorecardData, scorecardGender, selectedTee, showScorecardGenderToggle]);

  const parForHole = useCallback(
    (hole: number) => {
      if (demoScorecard) return DEMO_HOLE_PAR[hole] ?? 4;
      const raw = parsForGender?.[hole]?.trim();
      if (raw && raw !== "—" && raw !== "-") {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 4;
    },
    [demoScorecard, parsForGender],
  );

  const holeDescriptions = useMemo((): CourseHoleDescriptions => {
    if (holeDescriptionsProp && Object.keys(holeDescriptionsProp).length > 0) {
      return holeDescriptionsProp;
    }
    if (demoScorecard) {
      const demo: CourseHoleDescriptions = {};
      for (const [hole, text] of Object.entries(DEMO_HOLE_INFO)) {
        const n = Number(hole);
        if (Number.isFinite(n) && text) demo[n] = text;
      }
      return demo;
    }
    return {};
  }, [demoScorecard, holeDescriptionsProp]);

  const showHoleInfoToggle = Object.keys(holeDescriptions).length > 0;

  const resolvedContact = useMemo((): CourseContactInfo => {
    if (contact) return contact;
    if (demoScorecard) {
      return {
        addressLine: "100 Fairway Drive, Lakeside, OR 97449",
        mapsUrl: null,
        appleMapsUrl: null,
        phone: "(541) 555-0142",
        phoneHref: "tel:5415550142",
      };
    }
    return {
      addressLine: null,
      mapsUrl: null,
      appleMapsUrl: null,
      phone: null,
      phoneHref: null,
    };
  }, [contact, demoScorecard]);

  const holeDescription =
    holeDescriptions[activeHole] ??
    (demoScorecard ? DEMO_COURSE_INFO : null);

  const goToHole = useCallback(
    (hole: number) => {
      const clamped = Math.min(holeCount, Math.max(0, hole));
      setBarProgress(0);
      setFlyoverProgress(0);
      setScrollHintDismissed(false);
      setScrollHintKey((k) => k + 1);
      if (perHoleMode) {
        window.scrollTo({ top: 0, behavior: "instant" });
        setSelectedHole(Math.max(1, clamped));
        setScrubHole(Math.max(1, clamped));
      } else {
        setScrubHole(clamped);
        scrollTrackToProgress(holeStartProgress(clamped, holeCount));
      }
      const params = new URLSearchParams(searchParams.toString());
      if (clamped <= 0) params.delete("hole");
      else params.set("hole", String(clamped));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [holeCount, pathname, perHoleMode, router, searchParams, setBarProgress],
  );

  useEffect(() => {
    if (syncedFromUrl.current) return;
    syncedFromUrl.current = true;
    if (initialHole > 0) {
      requestAnimationFrame(() => {
        if (perHoleMode) {
          setSelectedHole(initialHole);
          setScrubHole(initialHole);
        } else {
          scrollTrackToProgress(holeStartProgress(initialHole, holeCount));
          setScrubHole(initialHole);
        }
      });
    }
  }, [holeCount, initialHole, perHoleMode]);

  useEffect(() => {
    setBarProgress(0);
    setFlyoverProgress(0);
  }, [activePlayback.videoSrc, activeHole, setBarProgress]);

  const teeYardage = useMemo(() => {
    if (demoScorecard) {
      return TEE_YARDAGES[selectedTee]?.[activeHole] ?? yardages[activeHole];
    }
    const tee = scorecardData?.tees[selectedTee];
    return tee?.yardages[activeHole] ?? yardages[activeHole];
  }, [activeHole, demoScorecard, scorecardData, selectedTee, yardages]);

  useEffect(() => {
    if (demoScorecard) return;
    const maxTee = Math.max(0, (scorecardData?.teeCount ?? 1) - 1);
    if (selectedTee > maxTee) setSelectedTee(maxTee);
  }, [demoScorecard, scorecardData?.teeCount, selectedTee]);

  const chartTee = useMemo((): ScorecardChartTee => {
    if (demoScorecard) {
      const teeYardages = TEE_YARDAGES[selectedTee] ?? TEE_YARDAGES[2];
      return {
        name: ["Black", "Blue", "Gold", "White", "Green", "Gray"][selectedTee] ?? `Tee ${selectedTee + 1}`,
        yardages: [...teeYardages].map((value) => String(value)),
        handicaps: [...DEMO_HOLE_HDCP].map((value) => String(value)),
        pars: [...DEMO_HOLE_PAR].map((value) => String(value)),
      };
    }
    if (scorecardData?.tees[selectedTee]) {
      const tee = scorecardTeeForGender(
        scorecardData.tees[selectedTee],
        showScorecardGenderToggle ? scorecardGender : "men",
      );
      return {
        name: tee.name,
        yardages: tee.yardages,
        handicaps: tee.handicaps,
        pars: tee.pars,
      };
    }
    return {
      name: "Yardage",
      yardages: yardages.map((value) => String(value)),
      handicaps: hdcp.map((value) => String(value)),
      pars: Array.from({ length: holeCount + 1 }, (_, hole) =>
        hole === 0 ? "—" : String(parForHole(hole)),
      ),
    };
  }, [
    demoScorecard,
    hdcp,
    holeCount,
    parForHole,
    scorecardData,
    selectedTee,
    yardages,
    scorecardGender,
    showScorecardGenderToggle,
  ]);

  const mobileTee = useMemo((): ScorecardMobileTee => {
    if (demoScorecard) {
      return {
        ...chartTee,
        pars: DEMO_HOLE_PAR.map((value) => String(value)),
      };
    }
    if (scorecardData?.tees[selectedTee]) {
      const tee = scorecardTeeForGender(
        scorecardData.tees[selectedTee],
        showScorecardGenderToggle ? scorecardGender : "men",
      );
      return {
        name: tee.name,
        yardages: tee.yardages,
        handicaps: tee.handicaps,
        pars: tee.pars,
      };
    }
    return {
      ...chartTee,
      pars: (parsForGender ?? []).map((value) => String(value ?? "—")),
    };
  }, [
    chartTee,
    demoScorecard,
    parsForGender,
    scorecardData,
    scorecardGender,
    selectedTee,
    showScorecardGenderToggle,
  ]);

  const teeOptions = useMemo(() => {
    if (demoScorecard) {
      const demoRatings = [
        { courseRating: "68.2", slopeRating: "120" },
        { courseRating: "70.1", slopeRating: "128" },
        { courseRating: "72.4", slopeRating: "133" },
        { courseRating: "74.0", slopeRating: "138" },
        { courseRating: "76.2", slopeRating: "142" },
      ];
      let demoParSum = 0;
      for (let hole = 1; hole <= holeCount; hole += 1) {
        demoParSum += DEMO_HOLE_PAR[hole] ?? 0;
      }
      const demoTotalPar = demoParSum > 0 ? String(demoParSum) : undefined;
      return TEE_COLORS.map((color, index) => ({
        index,
        totalYards: formatTotalYardsFromHoles(TEE_YARDAGES[index] ?? [], holeCount),
        totalPar: demoTotalPar,
        courseRating: demoRatings[index]?.courseRating,
        slopeRating: demoRatings[index]?.slopeRating,
        color,
      }));
    }
    const gender = showScorecardGenderToggle ? scorecardGender : "men";
    return (scorecardData?.tees ?? []).map((tee, index) => {
      const resolved = scorecardTeeForGender(tee, gender);
      return {
        index,
        totalYards:
          resolved.totalYards?.trim() ||
          formatTotalYardsFromHoles(resolved.yardages, holeCount),
        totalPar: scorecardDisplayTotalPar(tee, gender, holeCount),
        courseRating: resolved.courseRating,
        slopeRating: resolved.slopeRating,
        color: resolveTeeColor(tee.color, index, accentColor),
      };
    });
  }, [
    accentColor,
    demoScorecard,
    holeCount,
    scorecardData?.tees,
    scorecardGender,
    showScorecardGenderToggle,
  ]);

  const allTeeYardages = useMemo(() => {
    if (demoScorecard) return TEE_YARDAGES;
    if (scorecardData?.tees?.length) {
      return scorecardData.tees.map(
        (tee) =>
          scorecardTeeForGender(
            tee,
            showScorecardGenderToggle ? scorecardGender : "men",
          ).yardages,
      );
    }
    return [yardages];
  }, [
    demoScorecard,
    scorecardData?.tees,
    scorecardGender,
    showScorecardGenderToggle,
    yardages,
  ]);

  const selectedTeeColor =
    teeOptions[selectedTee]?.color ?? resolveTeeColor(undefined, selectedTee, accentColor);

  const selectedTeeTotalPar = useMemo(() => {
    if (demoScorecard) {
      let sum = 0;
      for (let hole = 1; hole <= holeCount; hole += 1) {
        sum += DEMO_HOLE_PAR[hole] ?? 0;
      }
      return sum > 0 ? String(sum) : undefined;
    }
    const gender = showScorecardGenderToggle ? scorecardGender : "men";
    const tee = scorecardData?.tees[selectedTee];
    if (!tee) return undefined;
    return scorecardDisplayTotalPar(tee, gender, holeCount);
  }, [
    demoScorecard,
    holeCount,
    scorecardData?.tees,
    scorecardGender,
    selectedTee,
    showScorecardGenderToggle,
  ]);

  const panelNavButtonClass = (active: boolean) =>
    `course-panel-nav-btn flex min-h-0 w-full flex-1 items-center justify-center rounded-md px-3 text-center text-[11px] font-semibold uppercase tracking-[0.15em] transition max-md:flex md:w-auto md:flex-none md:rounded md:px-3 md:py-1.5 md:text-[10px] ${
      active
        ? "bg-white/15 text-white"
        : "text-white/45 hover:text-white/75"
    }`;

  const panelNavButtons = useMemo(() => {
    const panelButtons = PANEL_NAV_ITEMS.filter(
      (item) => !item.panelKey || pagePanels[item.panelKey],
    ).map(({ id, label }) => (
      <button
        key={id}
        type="button"
        onClick={() => {
          setHoleDescOpen(false);
          if (id === "map") {
            setAerialViewMode("hole");
          }
          setPanelOpen((p) => (p === id ? null : id));
        }}
        className={panelNavButtonClass(panelOpen === id)}
      >
        {label}
      </button>
    ));

    if (pagePanels.bookTeeTime && pagePanels.bookTeeTimeUrl) {
      panelButtons.push(
        <a
          key="book-tee-time"
          href={pagePanels.bookTeeTimeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={panelNavButtonClass(false)}
        >
          Book Tee Time
        </a>,
      );
    }

    return panelButtons;
  }, [panelOpen, pagePanels, setAerialViewMode]);

  const handleHoleInfoOpenChange = useCallback((open: boolean) => {
    if (open) {
      setPanelOpen(null);
    }
    setHoleDescOpen(open);
  }, []);

  useEffect(() => {
    if (panelOpen != null) {
      setHoleDescOpen(false);
    }
  }, [panelOpen]);

  const hasPanelNav = panelNavButtons.length > 0;
  const portraitPanelBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen || panelOpen === "scorecard") return;
    const active = PANEL_NAV_ITEMS.find((item) => item.id === panelOpen);
    if (active?.panelKey && !pagePanels[active.panelKey]) {
      setPanelOpen(null);
    }
  }, [pagePanels, panelOpen]);

  // Mirror on <html> so portaled overlays (hole selector grid) can respect layout.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "course-has-portrait-panel-nav",
      hasPanelNav,
    );
    return () => {
      document.documentElement.classList.remove("course-has-portrait-panel-nav");
    };
  }, [hasPanelNav]);

  // Keep hole-selector / panel overlays above the real portrait panel bar height
  // (varies when buttons wrap, e.g. Book Tee Time on narrow screens).
  useEffect(() => {
    const el = portraitPanelBarRef.current;
    if (!hasPanelNav || !el) return;

    const syncHeight = () => {
      const height = el.getBoundingClientRect().height;
      if (height > 0) {
        document.documentElement.style.setProperty(
          "--course-mobile-portrait-panel-h",
          `${height}px`,
        );
      } else {
        document.documentElement.style.removeProperty("--course-mobile-portrait-panel-h");
      }
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
      document.documentElement.style.removeProperty("--course-mobile-portrait-panel-h");
    };
  }, [hasPanelNav, panelNavButtons.length]);

  const holeNavArrowFace = (direction: "prev" | "next") => (
    <svg viewBox="0 0 72 72" className="course-hole-nav-arrow-svg" aria-hidden>
      <circle
        cx="36"
        cy="36"
        r="35"
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="1.5"
      />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={direction === "prev" ? "rotate(180 36 36)" : undefined}
      >
        <path d="M31 22 L45 36 L31 50" />
      </g>
    </svg>
  );

  const mobileVideoChrome = (
    <>
      <div className="course-hole-nav-arrow course-hole-nav-arrow--prev pointer-events-auto">
        <button
          type="button"
          onClick={() => goToHole(activeHole <= 1 ? holeCount : activeHole - 1)}
          className="course-hole-nav-arrow-btn"
          aria-label="Previous hole"
        >
          {holeNavArrowFace("prev")}
        </button>
      </div>
      <div className="course-hole-nav-arrow course-hole-nav-arrow--next pointer-events-auto">
        <button
          type="button"
          onClick={() => goToHole(activeHole >= holeCount ? 1 : activeHole + 1)}
          className="course-hole-nav-arrow-btn"
          aria-label="Next hole"
        >
          {holeNavArrowFace("next")}
        </button>
      </div>
    </>
  );

  return (
    <div
      className={`relative min-h-screen bg-[#1a1814] ${
        hasPanelNav ? "course-has-portrait-panel-nav" : ""
      } ${panelOpen === "scorecard" ? "course-scorecard-open" : ""} ${
        panelOpen === "map" && aerialViewMode === "course" ? "course-aerial-open" : ""
      } ${
        panelOpen === "map" && aerialViewMode === "hole" ? "course-aerial-hole-view-open" : ""
      } ${panelOpen === "courses" ? "course-courses-open" : ""} ${
        holeDescOpen && showHoleInfoToggle ? "course-hole-info-open" : ""
      }`}
    >
      <ScrollyVideoSection
        key={
          perHoleMode
            ? `hole-${activeHole}-${activePlayback.videoSrc}-f${activePlayback.frames?.version ?? 0}`
            : `${activePlayback.videoSrc}-f${activePlayback.frames?.version ?? 0}`
        }
        src={activePlayback.videoSrc}
        fallbackSrc={activePlayback.fallbackVideoSrc}
        poster={activePlayback.posterUrl}
        frames={activePlayback.frames}
        heroVariant="coursePreview"
        courseHoleIndex={displayHole}
        accentColor={accentColor}
        scrollFlyLabel="SCROLL TO FLY"
        onScrubProgress={onScrubProgress}
        onVideoProgress={onVideoProgress}
        disableEndOverlay
        disableScrollOverlays
        showScrollHint={!scrollHintDismissed}
        scrollHintKey={scrollHintKey}
        onScrollHintDismiss={() => setScrollHintDismissed(true)}
        mobileFooter={
          <div className="course-mobile-nav-inner flex h-full min-h-0 flex-col">
            {hasPanelNav ? (
              <div className="course-mobile-nav-buttons flex min-h-0 flex-1 flex-col">
                {panelNavButtons}
              </div>
            ) : null}
            <Link
              href="/"
              className="course-mobile-nav-logo shrink-0 px-1 pb-1 pt-2"
              aria-label="Birdseye home"
            >
              <img
                src="/logo1.svg"
                alt="Birdseye"
                className="h-10 w-auto max-w-full object-contain object-left brightness-0 invert"
              />
            </Link>
          </div>
        }
        mobileVideoChrome={mobileVideoChrome}
        showFullscreenButton
      />

      <HoleSelectorOverlay
        hidden={
          isDesktopLayout &&
          (panelOpen === "scorecard" ||
            panelOpen === "courses" ||
            (panelOpen === "map" && aerialViewMode === "course"))
        }
        hideGrid={
          !isDesktopLayout &&
          (isMobilePortrait ||
            panelBlocksHoleSelector ||
            isAerialHoleViewOpen)
        }
        panelOpen={panelOpen}
        holeCount={holeCount}
        activeHole={activeHole}
        parForHole={parForHole}
        accentColor={accentColor}
        onHoleSelect={goToHole}
        onOpen={() => {
          if (panelOpen === "map") {
            setPanelOpen(null);
          }
        }}
      />

      {videoLogoSrc ? (
        <div className="course-video-logo pointer-events-none">
          {videoLogoSrc === "/example-course-logo.svg" ? (
            <ExampleCourseLogo className="course-video-logo-image h-full w-full" />
          ) : (
            <img
              src={videoLogoSrc}
              alt={courseTitle}
              className="course-video-logo-image h-full w-full object-contain object-left-bottom"
            />
          )}
        </div>
      ) : null}

      <CourseMenuButton
        courseTitle={courseTitle}
        contact={resolvedContact}
        activeHole={activeHole}
        showHoleInfoToggle={showHoleInfoToggle}
        holeInfoOpen={holeDescOpen}
        onHoleInfoOpenChange={handleHoleInfoOpenChange}
        hidden={
          !isMobilePortrait &&
          (panelOpen === "scorecard" ||
            (panelOpen === "map" && aerialViewMode === "course"))
        }
      />

      {isMobilePortrait ? (
        <ScorecardMobileDataOverlay
          open={panelOpen === "scorecard"}
          activeHole={activeHole}
          teeColor={selectedTeeColor}
          tee={mobileTee}
          teeOptions={teeOptions}
          selectedTee={selectedTee}
          onTeeSelect={setSelectedTee}
          onClose={() => setPanelOpen(null)}
          totalPar={selectedTeeTotalPar ?? teeOptions[selectedTee]?.totalPar}
        />
      ) : (
        <ScorecardChartOverlay
          open={panelOpen === "scorecard"}
          holeCount={holeCount}
          activeHole={activeHole}
          teeColor={selectedTeeColor}
          tee={chartTee}
          teeOptions={teeOptions}
          selectedTee={selectedTee}
          onTeeSelect={setSelectedTee}
          onHoleSelect={goToHole}
          onClose={() => setPanelOpen(null)}
          showGenderToggle={showScorecardGenderToggle}
          scorecardGender={scorecardGender}
          onGenderChange={setScorecardGender}
          totalPar={selectedTeeTotalPar ?? teeOptions[selectedTee]?.totalPar}
          allTeeYardages={allTeeYardages}
        />
      )}

      <CoursePanelOverlay
        open={panelOpen === "courses" && Boolean(pagePanels.courses)}
        courses={coursePanelButtons}
        onClose={() => setPanelOpen(null)}
      />

      <AerialPanelOverlay
        open={
          panelOpen === "map" &&
          aerialViewMode === "course" &&
          Boolean(pagePanels.aerial)
        }
        aerialMap={aerialMap}
        activeHole={activeHole}
        onHoleSelect={(hole) => {
          goToHole(hole);
          setPanelOpen(null);
        }}
        onEnterHoleView={() => setAerialViewMode("hole")}
        onClose={() => setPanelOpen(null)}
      />

      <HoleGraphicPanel
        open={
          panelOpen === "map" &&
          aerialViewMode === "hole" &&
          Boolean(pagePanels.aerial)
        }
        holeNumber={activeHole}
        par={parForHole(activeHole)}
        holeGraphic={holeGraphicMap.get(activeHole)}
        cameraPath={cameraPathMap.get(activeHole)}
        yardageArcs={yardageArcsMap.get(activeHole)}
        yardageArcRender={yardageArcRenderMap.get(activeHole)}
        flyoverProgress={flyoverProgress}
        onPathSeek={goToFlyoverProgress}
        useDesktopTopBar={isDesktopLayout}
        onCourseView={() => setAerialViewMode("course")}
        onClose={() => setPanelOpen(null)}
      />

      <Link
        href="/"
        className="course-birdseye-desktop-logo pointer-events-auto"
        aria-label="Birdseye home"
      >
        <img
          src="/logo1.svg"
          alt="Birdseye"
          className="h-16 w-auto max-w-[33vw] shrink-0 object-contain brightness-0 invert sm:max-w-none md:h-28"
        />
      </Link>

      {hasPanelNav ? (
        <div
          ref={portraitPanelBarRef}
          className="course-mobile-portrait-panel-bar pointer-events-auto"
        >
          {panelNavButtons}
        </div>
      ) : null}

      {/* Pinned outside the inset-0 chrome so iOS scroll-scrub can't shift it */}
      <div className="course-mobile-bottom-bar">
        <div className="course-mobile-bottom-bar-inner flex min-w-0 items-center gap-2 overflow-hidden">
          <Link
            href="/"
            className="course-mobile-bar-logo flex min-w-0 shrink-0 items-center rounded-md px-1 py-1"
            aria-label="Birdseye home"
          >
            <img
              src="/logo1.svg"
              alt="Birdseye"
              className="h-16 w-auto max-w-[33vw] shrink-0 object-contain brightness-0 invert sm:max-w-none md:h-28"
            />
          </Link>

          <div
            ref={progressWrapRef}
            className="course-mobile-progress-wrap relative mx-1 h-3 min-w-0 flex-1 touch-none md:mx-3"
            role="slider"
            tabIndex={0}
            aria-label="Video progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(flyoverProgress * 100)}
            aria-valuetext={`${Math.round(flyoverProgress * 100)} percent`}
            onPointerDown={onProgressPointerDown}
            onPointerMove={onProgressPointerMove}
            onPointerUp={onProgressPointerUp}
            onPointerCancel={onProgressPointerUp}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                goToFlyoverProgress(flyoverProgress - 0.04);
              } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                goToFlyoverProgress(flyoverProgress + 0.04);
              } else if (event.key === "Home") {
                event.preventDefault();
                goToFlyoverProgress(0);
              } else if (event.key === "End") {
                event.preventDefault();
                goToFlyoverProgress(1);
              }
            }}
          >
            <div className="course-mobile-progress-track absolute bottom-0 left-0 right-0 h-1 rounded-full bg-white/15" />
            <div
              ref={progressFillRef}
              className="course-mobile-progress-fill absolute bottom-0 h-1 rounded-full"
              style={{
                width: "0%",
                backgroundColor: "#00cdac",
              }}
            />
          </div>

          {hasPanelNav ? (
            <div className="course-desktop-panel-btns min-w-0 shrink gap-0.5 md:gap-1">
              {panelNavButtons}
            </div>
          ) : null}
        </div>
      </div>

      {/* CoursePreview-style overlay chrome */}
      <div className="pointer-events-none fixed inset-0 z-30 flex w-full max-w-[100vw] flex-col overflow-x-clip">
        {!hideLegacyChrome ? (
          <div className="flex shrink-0 items-start px-3 pt-3 md:px-5 md:pt-4">
            <div className="pointer-events-auto ml-[4.75rem] flex items-center gap-3 md:ml-[7.5rem]">
              <Link
                href="/"
                className="flex items-center gap-2 opacity-90 transition hover:opacity-100"
                aria-label="CoursePreview home"
              >
                <svg
                  viewBox="0 0 512 512"
                  className="h-7 w-7 fill-white md:h-8 md:w-8"
                  aria-hidden
                >
                  <path d="M493.7,479.2L264.1,20.1c-1-2.1-3.1-3.4-5.4-3.4s-4.4,1.3-5.4,3.4L23.7,479.2c-1.1,2.2-0.8,4.8,0.8,6.6c1.6,1.9,4.1,2.6,6.4,1.9l227.8-68.4l227.8,68.4c0.6,0.2,1.2,0.3,1.7,0.3c1.8,0,3.5-0.8,4.7-2.2C494.5,484,494.8,481.4,493.7,479.2z M322.7,279L248,233.6c-1.9-1.1-4.2-1.2-6.1-0.1c-1.9,1.1-3.1,3.1-3.1,5.3v144.8L94.5,427L258.7,98.5L422.9,427l-144.2-43.3v-71.4l43.6-22.6c2-1,3.2-3,3.3-5.2C325.7,282.2,324.5,280.2,322.7,279z" />
                </svg>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.25em] text-white/90 sm:inline">
                  CoursePreview
                </span>
              </Link>
            </div>
          </div>
        ) : null}

        {/* Middle: optional left panel + hole nav */}
        <div className="course-mobile-landscape-hide relative flex min-h-0 flex-1 items-stretch">
          {!hideLegacyChrome ? (
            <aside className="pointer-events-auto hidden w-[min(22vw,280px)] shrink-0 flex-col justify-between pb-28 pl-3 pt-2 md:flex md:pl-4">
              {/* Hole map card */}
              <div className="overflow-hidden rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm">
                <div
                  className="relative aspect-[4/3] bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${activePlayback.posterUrl})`,
                  }}
                >
                  <div className="absolute inset-0 flex flex-col justify-end p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                      Hole {activeHole}
                    </p>
                    <p className="font-serif text-lg text-white">
                      Par {parForHole(activeHole)}
                    </p>
                  </div>
                </div>

                {/* Tee yardage bar */}
                <div className="relative border-t border-white/10 px-2 py-3">
                  <div className="relative h-8">
                    {TEE_COLORS.map((color, i) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedTee(i)}
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{
                          left: `${8 + i * 14}%`,
                          zIndex: selectedTee === i ? 10 : 1,
                        }}
                        aria-label={`Tee ${i + 1}`}
                      >
                        <span
                          className={`block h-3 w-3 rounded-full ring-2 transition ${
                            selectedTee === i ? "ring-white scale-125" : "ring-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      </button>
                    ))}
                    <div
                      className="absolute top-1/2 h-0.5 w-[72%] -translate-y-1/2 bg-white/20"
                      style={{ left: "10%" }}
                      aria-hidden
                    />
                    <div
                      className="absolute top-0"
                      style={{ left: "78%" }}
                      aria-hidden
                    >
                      <div className="h-3 w-3 rounded-full bg-white/90" />
                      <div
                        className="mx-auto h-4 w-0.5"
                        style={{ backgroundColor: accentColor }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/70">
                    <span>{teeYardage} yds</span>
                    <span>to pin</span>
                  </div>
                </div>
              </div>

              {/* Yardage scale */}
              <div className="flex flex-col justify-center py-4">
                <div className="flex h-[min(50vh,420px)] flex-col justify-between text-[10px] tabular-nums text-white/45">
                  {ALT_TICKS.map((n) => (
                    <span key={n} className="leading-none">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 flex-1" />

          {/* Previous hole — left edge (desktop) */}
          <div className="course-hole-nav-arrow course-hole-nav-arrow--prev course-hole-nav-arrow--desktop pointer-events-auto">
            <button
              type="button"
              onClick={() => goToHole(activeHole <= 1 ? holeCount : activeHole - 1)}
              className="course-hole-nav-arrow-btn"
              aria-label="Previous hole"
            >
              {holeNavArrowFace("prev")}
            </button>
          </div>

          {/* Next hole — right edge (desktop) */}
          <div className="course-hole-nav-arrow course-hole-nav-arrow--next course-hole-nav-arrow--desktop pointer-events-auto">
            <button
              type="button"
              onClick={() => goToHole(activeHole >= holeCount ? 1 : activeHole + 1)}
              className="course-hole-nav-arrow-btn"
              aria-label="Next hole"
            >
              {holeNavArrowFace("next")}
            </button>
          </div>
        </div>

        {/* Hole description — below video / above footer; mutually exclusive with panels */}
        {holeDescOpen && showHoleInfoToggle ? (
          <div className="course-hole-info-panel pointer-events-auto absolute z-10 flex justify-center px-3">
            <div className="course-hole-info-card">
              <div className="course-hole-info-card-header">
                <p className="course-hole-info-label">
                  Hole {activeHole} · Par {parForHole(activeHole)}
                </p>
                <button
                  type="button"
                  className="course-hole-info-hide"
                  onClick={() => handleHoleInfoOpenChange(false)}
                  aria-label="Hide hole information"
                >
                  Hide
                </button>
              </div>
              <p className="course-hole-info-text">
                {holeDescription ?? "No information available for this hole yet."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
