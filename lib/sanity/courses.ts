import { resolveTeeColor } from "@/lib/constants/teeColors";
import { defineQuery } from "next-sanity";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "@/sanity/lib/image";
import { sanityClient, sanityFetchOptions } from "./client";
import { muxHlsUrl, muxPosterUrl, muxStaticMp4Url } from "../mux";
import {
  flyoverManifestUrl,
  type FlyoverFrameSequence,
} from "../flyover-frames";
import {
  type YardageArcClipPoint,
  type YardageArcMarker,
  type YardageArcPin,
  type YardageArcsData,
} from "@/lib/yardage-arcs";

export type { FlyoverFrameSequence } from "../flyover-frames";
export type { YardageArcClipPoint, YardageArcMarker, YardageArcPin, YardageArcsData };

export type MuxAssetRef = {
  playbackId?: string;
  status?: string;
  thumbTime?: number;
} | null;

export type MuxVideoField = {
  asset?: MuxAssetRef;
} | null;

export type HoleGraphicDoc = {
  alt?: string | null;
  asset?: { _ref?: string; url?: string; mimeType?: string } | null;
} | null;

export type HoleGraphic = {
  src: string;
  alt?: string;
  isSvg: boolean;
};

export type CameraPathPoint = {
  x: number;
  y: number;
};

export type HoleFlyoverDoc = {
  holeNumber: number;
  description?: string | null;
  flyoverVideo?: MuxVideoField;
  flyoverFrames?: FlyoverFrameSequence;
  holeGraphic?: HoleGraphicDoc;
  cameraPath?: CameraPathPoint[] | null;
  yardageArcs?: {
    pin?: YardageArcPin | null;
    markers?: YardageArcMarker[] | null;
    arcClip?: YardageArcClipPoint[] | null;
  } | null;
};

export type CourseAddressDoc = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
} | null;

export type CourseContactInfo = {
  /** Single-line address for display + maps search. */
  addressLine: string | null;
  /** Direct link to the course's Google Maps listing, when set in Sanity. */
  mapsUrl: string | null;
  /** Direct link to the course's Apple Maps listing, when set in Sanity. */
  appleMapsUrl: string | null;
  phone: string | null;
  /** tel: href value, or null when phone is empty. */
  phoneHref: string | null;
};

/** Per-hole copy keyed by hole number (only holes with non-empty text). */
export type CourseHoleDescriptions = Record<number, string>;

export type ScorecardGender = "men" | "women";

export type ScorecardGenderRatingsDoc = {
  courseRating?: string | null;
  slopeRating?: string | null;
};

export type ScorecardGenderValuesDoc = {
  men?: string | null;
  women?: string | null;
};

/** @deprecated Alias for {@link ScorecardGenderValuesDoc} */
export type ScorecardHandicapDoc = ScorecardGenderValuesDoc;

export type ScorecardTeeEntryDoc = {
  /** Legacy documents may store a plain string (men's). */
  par?: ScorecardGenderValuesDoc | string | null;
  yardage?: string | null;
  /** Stroke index; legacy documents may store a plain string (men's). */
  handicap?: ScorecardHandicapDoc | string | null;
};

export type HoleScorecardDoc = {
  holeNumber: number;
  /** @deprecated Use tees[].par */
  par?: ScorecardGenderValuesDoc | string | null;
  tees?: ScorecardTeeEntryDoc[] | null;
  /** @deprecated Legacy single-tee fields */
  yardage?: string | null;
  /** @deprecated Legacy single-tee fields */
  handicap?: string | null;
};

export type ScorecardTeeSetDoc = {
  name?: string | null;
  totalYards?: string | null;
  totalPar?: ScorecardGenderValuesDoc | null;
  color?: string | null;
  ratings?: {
    men?: ScorecardGenderRatingsDoc | null;
    women?: ScorecardGenderRatingsDoc | null;
  } | null;
  /** @deprecated Use ratings.men */
  courseRating?: string | null;
  /** @deprecated Use ratings.men */
  slopeRating?: string | null;
};

export type ScorecardConfigDoc = {
  hasWomenRatings?: boolean | null;
  teeCount?: number | null;
  teeSets?: ScorecardTeeSetDoc[] | null;
  /** @deprecated Legacy tee name list */
  teeNames?: (string | null)[] | null;
  holes?: HoleScorecardDoc[] | null;
};

export type ScorecardGenderRatingsData = {
  courseRating?: string;
  slopeRating?: string;
};

export type ScorecardTeeData = {
  name: string;
  totalYards?: string;
  /** Men's ratings (convenience; same as ratings.men). */
  courseRating?: string;
  slopeRating?: string;
  color?: string;
  yardages: string[];
  /** Men's stroke index per hole (convenience; same as handicapsByGender.men). */
  handicaps: string[];
  ratings: {
    men?: ScorecardGenderRatingsData;
    women?: ScorecardGenderRatingsData;
  };
  handicapsByGender: {
    men: string[];
    women: string[];
  };
  /** Men's par per hole for this tee (convenience; same as parsByGender.men). */
  pars: string[];
  parsByGender: {
    men: string[];
    women: string[];
  };
  /** Men's total par for this tee (convenience). */
  totalPar?: string;
  /** Total par entered on the tee set in Sanity (not auto-summed). */
  cmsTotalPar: {
    men?: string;
    women?: string;
  };
  totalParByGender: {
    men?: string;
    women?: string;
  };
};

export type CourseScorecardData = {
  teeCount: number;
  /** When true, the scorecard UI should offer a Men's/Women's toggle. */
  hasWomenRatings: boolean;
  tees: ScorecardTeeData[];
  /** Primary tee yardages (1-indexed by hole). */
  yardages: string[];
  /** Primary tee men's handicaps (1-indexed by hole). */
  handicaps: string[];
  /** Primary tee men's par per hole (1-indexed). */
  pars: string[];
  /** Primary tee par by gender (1-indexed). */
  parsByGender: {
    men: string[];
    women: string[];
  };
};

export type CourseLogo = {
  alt?: string | null;
  asset?: { _ref?: string; url?: string; mimeType?: string } | null;
} | null;

export type CourseAerialMap = {
  alt?: string | null;
  asset?: { _ref?: string; url?: string; mimeType?: string } | null;
} | null;

export type CourseAerialMapHotspot = {
  holeNumber: number;
  x: number;
  y: number;
};

export type CourseAerialMapData = {
  src: string;
  alt?: string;
  isVideo: boolean;
  hotspots?: CourseAerialMapHotspot[];
};

export type RelatedCourseLink = {
  _key?: string;
  title: string | null;
  slug: string | null;
};

/** Raw Sanity shape for courseSelections before dereferencing. */
type CourseSelectionDoc = {
  _key?: string;
  course?: {
    title?: string | null;
    slug?: string | null;
  } | null;
};

export type CoursePagePanelsDoc = {
  aerial?: boolean | null;
  courses?: boolean | null;
  bookTeeTime?: boolean | null;
  bookTeeTimeUrl?: string | null;
  courseCount?: number | null;
  courseSelections?: CourseSelectionDoc[] | null;
};

export type CoursePagePanels = {
  aerial?: boolean | null;
  courses?: boolean | null;
  bookTeeTime?: boolean | null;
  bookTeeTimeUrl?: string | null;
  courseCount?: number | null;
  courseSelections?: RelatedCourseLink[] | null;
};

export type CourseAerialHotspotDoc = {
  _key?: string;
  holeNumber?: number | null;
  x?: number | null;
  y?: number | null;
};

export type CourseDoc = {
  _id: string;
  _updatedAt?: string | null;
  title: string | null;
  slug: string | null;
  holeCount?: number | null;
  courseLogo?: CourseLogo;
  address?: CourseAddressDoc;
  googleMapsUrl?: string | null;
  appleMapsUrl?: string | null;
  phone?: string | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImage?: CourseLogo | null;
  } | null;
  aerialMap?: CourseAerialMap;
  aerialHotspots?: CourseAerialHotspotDoc[] | null;
  pagePanels?: CoursePagePanelsDoc | null;
  scorecard?: ScorecardConfigDoc | null;
  /** @deprecated Legacy scorecard storage */
  scorecardHoles?: HoleScorecardDoc[] | null;
  holes?: HoleFlyoverDoc[] | null;
};

export type CoursePlaybackUrls = {
  /** Progressive MP4 for scroll-scrub (preferred). */
  videoSrc: string;
  /** HLS when the asset has no static MP4 yet (uploaded before static renditions). */
  fallbackVideoSrc: string;
  posterUrl: string;
  playbackId: string;
};

export type HolePlayback = CoursePlaybackUrls & {
  holeNumber: number;
  playbackId: string;
  frames?: FlyoverFrameSequence;
  holeGraphic?: HoleGraphic;
  cameraPath?: CameraPathPoint[];
  yardageArcs?: YardageArcsData;
};

const flyoverFramesProjection = `
  flyoverFrames {
    status,
    manifestUrl,
    frameCount,
    fps,
    version
  }
`;

const muxAssetProjection = `
  asset->{
    "playbackId": coalesce(
      playbackId,
      data.playback_ids[0].id
    ),
    status,
    thumbTime
  }
`;

const holeFlyoverProjection = `
  holeNumber,
  description,
  holeGraphic {
    alt,
    asset->{
      _id,
      url,
      mimeType
    }
  },
  cameraPath[] {
    x,
    y
  },
  yardageArcs {
    pin { x, y },
    markers[] { x, y, yards },
    arcClip[] { x, y }
  },
  flyoverVideo {
    ${muxAssetProjection}
  },
  ${flyoverFramesProjection}
`;

function formatCourseAddressLine(address: CourseAddressDoc | undefined): string | null {
  if (!address) return null;
  const line1 = address.line1?.trim() || "";
  const city = address.city?.trim() || "";
  const state = address.state?.trim() || "";
  const postal = address.postalCode?.trim() || "";
  const cityState = [city, state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, postal].filter(Boolean).join(" ");
  const parts = [line1, cityStateZip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function phoneTelHref(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

/** Address + phone for the course video menu. */
export function courseContactInfo(
  course: CourseDoc | null,
): CourseContactInfo {
  const phone = course?.phone?.trim() || null;
  return {
    addressLine: formatCourseAddressLine(course?.address),
    mapsUrl: course?.googleMapsUrl?.trim() || null,
    appleMapsUrl: course?.appleMapsUrl?.trim() || null,
    phone,
    phoneHref: phoneTelHref(phone),
  };
}

/** Hole blurbs entered in Sanity. Empty object when none are set. */
export function courseHoleDescriptions(
  course: CourseDoc | null,
): CourseHoleDescriptions {
  const out: CourseHoleDescriptions = {};
  for (const hole of course?.holes ?? []) {
    const text = hole.description?.trim();
    if (!text || !Number.isFinite(hole.holeNumber)) continue;
    out[hole.holeNumber] = text;
  }
  return out;
}

export function muxVideoFieldUrls(
  muxVideo: MuxVideoField | null | undefined,
): CoursePlaybackUrls | null {
  const playbackId = muxVideo?.asset?.playbackId;
  if (!playbackId) return null;
  return {
    videoSrc: muxStaticMp4Url(playbackId),
    fallbackVideoSrc: muxHlsUrl(playbackId),
    posterUrl: muxPosterUrl(playbackId, muxVideo?.asset?.thumbTime),
    playbackId,
  };
}

function resolveHoleFrames(
  playbackId: string,
  flyoverFrames: FlyoverFrameSequence | undefined,
): FlyoverFrameSequence {
  const stored = flyoverFrames?.manifestUrl;
  // After replacing a Mux video, an old manifestUrl can still point at the
  // previous playbackId's frames — ignore it unless it matches the current asset.
  if (stored && stored.includes(playbackId)) {
    return flyoverFrames as FlyoverFrameSequence;
  }
  return { manifestUrl: flyoverManifestUrl(playbackId) };
}

function resolveCameraPath(hole: HoleFlyoverDoc): CameraPathPoint[] | undefined {
  if (!Array.isArray(hole.cameraPath) || hole.cameraPath.length < 2) return undefined;
  const points = hole.cameraPath
    .map((point) => ({
      x: typeof point.x === "number" ? point.x : NaN,
      y: typeof point.y === "number" ? point.y : NaN,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return points.length >= 2 ? points : undefined;
}

function resolveYardageArcs(hole: HoleFlyoverDoc): YardageArcsData | undefined {
  const pin = hole.yardageArcs?.pin;
  if (
    !pin ||
    typeof pin.x !== "number" ||
    typeof pin.y !== "number" ||
    !Number.isFinite(pin.x) ||
    !Number.isFinite(pin.y)
  ) {
    return undefined;
  }

  const markers = (hole.yardageArcs?.markers ?? [])
    .map((marker) => ({
      x: typeof marker.x === "number" ? marker.x : NaN,
      y: typeof marker.y === "number" ? marker.y : NaN,
      yards: typeof marker.yards === "number" ? marker.yards : NaN,
    }))
    .filter(
      (marker) =>
        Number.isFinite(marker.x) &&
        Number.isFinite(marker.y) &&
        Number.isFinite(marker.yards) &&
        marker.yards > 0,
    );

  if (markers.length === 0) return undefined;

  const arcClip = (hole.yardageArcs?.arcClip ?? [])
    .map((point) => ({
      x: typeof point.x === "number" ? point.x : NaN,
      y: typeof point.y === "number" ? point.y : NaN,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 100 &&
        point.y >= 0 &&
        point.y <= 100,
    );

  return {
    pin: { x: pin.x, y: pin.y },
    markers,
    ...(arcClip.length >= 3 ? { arcClip } : {}),
  };
}

/**
 * Serve Sanity file assets via our own origin so browsers can load them
 * without hitting cdn.sanity.io's CORS 403 on Origin-bearing requests.
 */
export function proxiedSanityFileUrl(src: string): string {
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "https:" || parsed.hostname !== "cdn.sanity.io") {
      return src;
    }
    // /files/{projectId}/...
    const match = parsed.pathname.match(/^\/files\/([^/]+)\//);
    if (!match) return src;

    const pathProjectId = match[1];
    const configuredId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
    // Prefer configured id when present; otherwise trust the CDN path.
    if (configuredId && pathProjectId !== configuredId) return src;

    return `/api/sanity-file?url=${encodeURIComponent(src)}`;
  } catch {
    return src;
  }
}

function resolveHoleGraphic(hole: HoleFlyoverDoc): HoleGraphic | undefined {
  const asset = hole.holeGraphic?.asset;
  const src = asset?.url?.trim();
  if (!src) return undefined;

  const mimeType = asset?.mimeType ?? "";
  const isSvg =
    mimeType === "image/svg+xml" ||
    src.toLowerCase().endsWith(".svg");

  return {
    src: proxiedSanityFileUrl(src),
    alt: hole.holeGraphic?.alt?.trim() || undefined,
    isSvg,
  };
}

export function courseHolePlaybacks(course: CourseDoc | null): HolePlayback[] {
  if (!course?.holes?.length) return [];
  const playbacks: HolePlayback[] = [];
  for (const hole of course.holes) {
    const urls = muxVideoFieldUrls(hole.flyoverVideo);
    if (!urls) continue;
    const holeGraphic = resolveHoleGraphic(hole);
    const cameraPath = resolveCameraPath(hole);
    const yardageArcs = resolveYardageArcs(hole);
    playbacks.push({
      holeNumber: hole.holeNumber,
      ...urls,
      frames: resolveHoleFrames(urls.playbackId, hole.flyoverFrames),
      ...(holeGraphic ? { holeGraphic } : {}),
      ...(cameraPath ? { cameraPath } : {}),
      ...(yardageArcs ? { yardageArcs } : {}),
    });
  }
  return playbacks.sort((a, b) => a.holeNumber - b.holeNumber);
}

export type HoleGraphicEntry = {
  holeNumber: number;
  graphic: HoleGraphic;
  cameraPath?: CameraPathPoint[];
  yardageArcs?: YardageArcsData;
};

/** Per-hole layout graphics (includes holes without video). */
export function courseHoleGraphics(course: CourseDoc | null): HoleGraphicEntry[] {
  if (!course?.holes?.length) return [];
  const entries: HoleGraphicEntry[] = [];
  for (const hole of course.holes) {
    const graphic = resolveHoleGraphic(hole);
    if (graphic && typeof hole.holeNumber === "number") {
      const cameraPath = resolveCameraPath(hole);
      const yardageArcs = resolveYardageArcs(hole);
      entries.push({
        holeNumber: hole.holeNumber,
        graphic,
        ...(cameraPath ? { cameraPath } : {}),
        ...(yardageArcs ? { yardageArcs } : {}),
      });
    }
  }
  return entries.sort((a, b) => a.holeNumber - b.holeNumber);
}

export function courseHasPlayableVideo(course: CourseDoc | null): boolean {
  if (!course) return false;
  return courseHolePlaybacks(course).length > 0;
}

/** Resolved panel toggles and course links for the course preview UI. */
export function coursePagePanels(
  course: CourseDoc | null,
  { defaultOn = false }: { defaultOn?: boolean } = {},
): Required<CoursePagePanels> {
  const bookTeeTime = course?.pagePanels?.bookTeeTime ?? false;
  const bookTeeTimeUrl = course?.pagePanels?.bookTeeTimeUrl?.trim() || null;
  return {
    aerial: course?.pagePanels?.aerial ?? defaultOn,
    courses: course?.pagePanels?.courses ?? defaultOn,
    bookTeeTime,
    bookTeeTimeUrl: bookTeeTime && bookTeeTimeUrl ? bookTeeTimeUrl : null,
    courseCount: course?.pagePanels?.courseCount ?? 2,
    courseSelections: (course?.pagePanels?.courseSelections ?? [])
      .map((item) => ({
        _key: item._key,
        title: item.course?.title ?? null,
        slug: item.course?.slug ?? null,
      }))
      .filter((item) => item.title && item.slug),
  };
}

const SCORECARD_EMPTY = "—";

function emptyHoleArrays(holeCount: number): {
  yardages: string[];
  handicaps: string[];
  pars: string[];
  parsByGender: { men: string[]; women: string[] };
} {
  const empty = Array.from({ length: holeCount + 1 }, () => SCORECARD_EMPTY);
  return {
    yardages: [...empty],
    handicaps: [...empty],
    pars: [...empty],
    parsByGender: { men: [...empty], women: [...empty] },
  };
}

function coerceScorecardString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === SCORECARD_EMPTY || trimmed === "-") {
      return undefined;
    }
    return trimmed;
  }
  return undefined;
}

function resolveGenderValuesDoc(
  raw: ScorecardGenderValuesDoc | string | null | undefined,
  gender: ScorecardGender,
): string | undefined {
  if (typeof raw === "string") {
    const value = coerceScorecardString(raw);
    return gender === "men" ? value : undefined;
  }
  const men = coerceScorecardString(raw?.men);
  const women = coerceScorecardString(raw?.women);
  if (gender === "women") {
    return women ?? men;
  }
  return men;
}

/** @deprecated Hole-level par; use {@link resolveEntryPar}. */
function resolveHolePar(
  row: HoleScorecardDoc,
  gender: ScorecardGender,
): string | undefined {
  return resolveGenderValuesDoc(row.par, gender);
}

function resolveEntryPar(
  entry: ScorecardTeeEntryDoc,
  gender: ScorecardGender,
): string | undefined {
  return resolveGenderValuesDoc(entry.par, gender);
}

function entryHasWomenPar(entry: ScorecardTeeEntryDoc): boolean {
  const raw = entry.par;
  if (typeof raw === "string") return false;
  return Boolean(raw?.women?.trim());
}

function holeHasWomenPar(row: HoleScorecardDoc): boolean {
  const raw = row.par;
  if (typeof raw === "string") return false;
  return Boolean(raw?.women?.trim());
}

function resolveScorecardHoles(
  course: CourseDoc | null,
): HoleScorecardDoc[] {
  if (course?.scorecard?.holes?.length) return course.scorecard.holes;
  return course?.scorecardHoles ?? [];
}

function resolveScorecardTeeCount(course: CourseDoc | null): number {
  const count = course?.scorecard?.teeCount ?? 1;
  return Math.min(6, Math.max(1, count));
}

function resolveScorecardTeeSets(
  course: CourseDoc | null,
  teeCount: number,
): ScorecardTeeSetDoc[] {
  const sets = course?.scorecard?.teeSets ?? [];
  const legacyNames = course?.scorecard?.teeNames ?? [];

  return Array.from({ length: teeCount }, (_, index) => {
    const set = sets[index];
    if (set) return set;
    const legacyName = legacyNames[index]?.trim();
    return legacyName ? { name: legacyName } : {};
  });
}

function holeTeeEntries(
  row: HoleScorecardDoc,
  teeCount: number,
): ScorecardTeeEntryDoc[] {
  if (row.tees?.length) {
    return Array.from({ length: teeCount }, (_, index) => row.tees?.[index] ?? {});
  }
  if (row.yardage || row.handicap) {
    const legacyHandicap =
      typeof row.handicap === "string" ? row.handicap : undefined;
    return [
      {
        yardage: row.yardage,
        handicap: legacyHandicap
          ? { men: legacyHandicap, women: "" }
          : undefined,
      },
    ];
  }
  return Array.from({ length: teeCount }, () => ({}));
}

function resolveGenderRatingsDoc(
  doc: ScorecardGenderRatingsDoc | null | undefined,
): ScorecardGenderRatingsData | undefined {
  const courseRating = doc?.courseRating?.trim();
  const slopeRating = doc?.slopeRating?.trim();
  if (!courseRating && !slopeRating) return undefined;
  return {
    courseRating: courseRating || undefined,
    slopeRating: slopeRating || undefined,
  };
}

function resolveTeeSetTotalPar(
  set: ScorecardTeeSetDoc,
  gender: ScorecardGender,
): string | undefined {
  return resolveGenderValuesDoc(set.totalPar, gender);
}

function sumParsForHoles(
  pars: string[],
  holeCount: number,
): string | undefined {
  let sum = 0;
  let hasValue = false;
  for (let hole = 1; hole <= holeCount; hole += 1) {
    const raw = pars[hole]?.trim();
    if (!raw || raw === SCORECARD_EMPTY || raw === "-") continue;
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value)) {
      sum += value;
      hasValue = true;
    }
  }
  return hasValue ? String(sum) : undefined;
}

function resolveTeeSetRatings(
  set: ScorecardTeeSetDoc,
  gender: ScorecardGender,
): ScorecardGenderRatingsData | undefined {
  const fromBlock = resolveGenderRatingsDoc(set.ratings?.[gender] ?? undefined);
  if (fromBlock) return fromBlock;
  if (gender !== "men") return undefined;
  const courseRating = set.courseRating?.trim();
  const slopeRating = set.slopeRating?.trim();
  if (!courseRating && !slopeRating) return undefined;
  return {
    courseRating: courseRating || undefined,
    slopeRating: slopeRating || undefined,
  };
}

function resolveEntryHandicap(
  entry: ScorecardTeeEntryDoc,
  gender: ScorecardGender,
): string | undefined {
  const raw = entry.handicap;
  if (typeof raw === "string") {
    const value = raw.trim();
    return gender === "men" && value ? value : undefined;
  }
  const men = raw?.men?.trim();
  const women = raw?.women?.trim();
  if (gender === "women") {
    const value = women || men;
    return value || undefined;
  }
  return men || undefined;
}

function teeSetHasWomenData(set: ScorecardTeeSetDoc): boolean {
  if (resolveGenderRatingsDoc(set.ratings?.women ?? undefined)) return true;
  return false;
}

function entryHasWomenHandicap(entry: ScorecardTeeEntryDoc): boolean {
  const raw = entry.handicap;
  if (typeof raw === "string") return false;
  return Boolean(raw?.women?.trim());
}

/** Whether the course page should show the Men's/Women's scorecard toggle. */
export function courseHasWomenScorecard(course: CourseDoc | null): boolean {
  if (course?.scorecard?.hasWomenRatings) return true;
  for (const set of course?.scorecard?.teeSets ?? []) {
    if (teeSetHasWomenData(set)) return true;
  }
  for (const row of resolveScorecardHoles(course)) {
    if (holeHasWomenPar(row)) return true;
    for (const entry of row.tees ?? []) {
      if (entryHasWomenPar(entry)) return true;
      if (entryHasWomenHandicap(entry)) return true;
    }
  }
  return false;
}

/** Total par from Sanity for display (tee set footer field), with sum fallback. */
export function scorecardDisplayTotalPar(
  tee: ScorecardTeeData,
  gender: ScorecardGender,
  holeCount: number,
): string | undefined {
  const cmsMen = tee.cmsTotalPar.men;
  const cmsWomen = tee.cmsTotalPar.women;
  const fromCms =
    gender === "women" ? (cmsWomen ?? cmsMen) : cmsMen;
  if (fromCms) return fromCms;

  const pars =
    gender === "women" ? tee.parsByGender.women : tee.parsByGender.men;
  return sumParsForHoles(pars, holeCount);
}

/** Par values per hole for a tee and gender (1-indexed). */
export function scorecardParsForGender(
  data: CourseScorecardData,
  gender: ScorecardGender,
  teeIndex = 0,
): string[] {
  const tee = data.tees[teeIndex];
  if (!tee) {
    return gender === "women" ? data.parsByGender.women : data.parsByGender.men;
  }
  return gender === "women" ? tee.parsByGender.women : tee.parsByGender.men;
}

/** Resolve tee ratings and per-hole handicaps for a gender. */
export function scorecardTeeForGender(
  tee: ScorecardTeeData,
  gender: ScorecardGender,
): Pick<
  ScorecardTeeData,
  | "name"
  | "totalYards"
  | "color"
  | "yardages"
  | "pars"
  | "totalPar"
  | "totalParByGender"
> & {
  courseRating?: string;
  slopeRating?: string;
  handicaps: string[];
  parsByGender: ScorecardTeeData["parsByGender"];
} {
  const ratings =
    gender === "women"
      ? tee.ratings.women ?? tee.ratings.men
      : tee.ratings.men;
  const handicaps =
    gender === "women" ? tee.handicapsByGender.women : tee.handicapsByGender.men;
  const pars =
    gender === "women" ? tee.parsByGender.women : tee.parsByGender.men;
  const totalPar = scorecardDisplayTotalPar(
    tee,
    gender,
    Math.max(0, pars.length - 1),
  );
  return {
    name: tee.name,
    totalYards: tee.totalYards,
    color: tee.color,
    yardages: tee.yardages,
    courseRating: ratings?.courseRating ?? tee.courseRating,
    slopeRating: ratings?.slopeRating ?? tee.slopeRating,
    handicaps,
    pars,
    parsByGender: tee.parsByGender,
    totalPar,
    totalParByGender: tee.totalParByGender,
  };
}

/** Per-hole yardages and handicaps for the scorecard panel (1-indexed arrays). */
export function courseScorecardData(
  course: CourseDoc | null,
  holeCount: number,
): CourseScorecardData {
  const teeCount = resolveScorecardTeeCount(course);
  const teeSetDocs = resolveScorecardTeeSets(course, teeCount);
  const holes = resolveScorecardHoles(course);
  const holeArrays = emptyHoleArrays(holeCount);

  const tees: ScorecardTeeData[] = teeSetDocs.map((set, index) => {
    const menRatings = resolveTeeSetRatings(set, "men");
    const womenRatings = resolveTeeSetRatings(set, "women");
    const menTotalPar = resolveTeeSetTotalPar(set, "men");
    const womenTotalPar = resolveTeeSetTotalPar(set, "women");
    return {
      name: set.name?.trim() || `Tee ${index + 1}`,
      totalYards: set.totalYards?.trim() || undefined,
      courseRating: menRatings?.courseRating,
      slopeRating: menRatings?.slopeRating,
      color: resolveTeeColor(set.color, index),
      yardages: [...holeArrays.yardages],
      handicaps: [...holeArrays.handicaps],
      ratings: {
        men: menRatings,
        women: womenRatings,
      },
      handicapsByGender: {
        men: [...holeArrays.handicaps],
        women: [...holeArrays.handicaps],
      },
      pars: [...holeArrays.pars],
      parsByGender: {
        men: [...holeArrays.parsByGender.men],
        women: [...holeArrays.parsByGender.women],
      },
      cmsTotalPar: {
        men: menTotalPar,
        women: womenTotalPar,
      },
      totalPar: menTotalPar,
      totalParByGender: {
        men: menTotalPar,
        women: womenTotalPar,
      },
    };
  });

  for (const row of holes) {
    const n = row.holeNumber;
    if (n < 1 || n > holeCount) continue;
    const legacyMenPar = resolveHolePar(row, "men");
    const legacyWomenPar = resolveHolePar(row, "women");
    const entries = holeTeeEntries(row, teeCount);
    entries.forEach((entry, teeIndex) => {
      const yardage = entry.yardage?.trim();
      const menPar =
        resolveEntryPar(entry, "men") ?? legacyMenPar;
      const womenPar =
        resolveEntryPar(entry, "women") ?? legacyWomenPar;
      const menHandicap = resolveEntryHandicap(entry, "men");
      const womenHandicap = resolveEntryHandicap(entry, "women");
      if (yardage) tees[teeIndex].yardages[n] = yardage;
      if (menPar) {
        tees[teeIndex].pars[n] = menPar;
        tees[teeIndex].parsByGender.men[n] = menPar;
      }
      if (womenPar) {
        tees[teeIndex].parsByGender.women[n] = womenPar;
      }
      if (menHandicap) {
        tees[teeIndex].handicaps[n] = menHandicap;
        tees[teeIndex].handicapsByGender.men[n] = menHandicap;
      }
      if (womenHandicap) {
        tees[teeIndex].handicapsByGender.women[n] = womenHandicap;
      }
    });
  }

  for (let teeIndex = 0; teeIndex < tees.length; teeIndex += 1) {
    const tee = tees[teeIndex];
    tee.totalPar = scorecardDisplayTotalPar(tee, "men", holeCount);
    tee.totalParByGender.men = tee.cmsTotalPar.men;
    tee.totalParByGender.women = tee.cmsTotalPar.women;
  }

  const primary = tees[0] ?? {
    name: "Tee 1",
    yardages: holeArrays.yardages,
    handicaps: holeArrays.handicaps,
    pars: holeArrays.pars,
    ratings: {},
    handicapsByGender: {
      men: holeArrays.handicaps,
      women: holeArrays.handicaps,
    },
    parsByGender: {
      men: holeArrays.parsByGender.men,
      women: holeArrays.parsByGender.women,
    },
    cmsTotalPar: {},
    totalPar: undefined,
    totalParByGender: { men: undefined, women: undefined },
  };

  return {
    teeCount,
    hasWomenRatings: courseHasWomenScorecard(course),
    tees,
    yardages: primary.yardages,
    handicaps: primary.handicaps,
    pars: holeArrays.pars,
    parsByGender: holeArrays.parsByGender,
  };
}

/** URL for the course logo overlay on hole pages (square, max 512px). */
export function courseLogoSrc(course: CourseDoc | null): string | undefined {
  if (!course?.courseLogo?.asset) return undefined;
  return urlFor(course.courseLogo as SanityImageSource)
    .width(512)
    .height(512)
    .fit("max")
    .url();
}

/** Optional Sanity SEO Open Graph image (~1200×630 social share). */
export function courseSeoOgImageSrc(
  course: CourseDoc | null,
): string | undefined {
  if (!course?.seo?.ogImage?.asset) return undefined;
  return urlFor(course.seo.ogImage as SanityImageSource)
    .width(1200)
    .height(630)
    .fit("crop")
    .url();
}

function courseAerialHotspots(
  course: CourseDoc | null,
): CourseAerialMapHotspot[] | undefined {
  const items = course?.aerialHotspots;
  if (!Array.isArray(items) || items.length === 0) return undefined;

  const hotspots = items
    .map((item) => {
      const holeNumber = item?.holeNumber;
      const x = item?.x;
      const y = item?.y;
      if (
        typeof holeNumber !== "number" ||
        typeof x !== "number" ||
        typeof y !== "number"
      ) {
        return null;
      }
      return { holeNumber, x, y };
    })
    .filter((item): item is CourseAerialMapHotspot => item != null)
    .sort((a, b) => a.holeNumber - b.holeNumber);

  return hotspots.length > 0 ? hotspots : undefined;
}

/** Aerial map asset for the Aerial panel (image or WebM video). */
export function courseAerialMap(
  course: CourseDoc | null,
): CourseAerialMapData | undefined {
  const asset = course?.aerialMap?.asset;
  const src = asset?.url?.trim();
  if (!src) return undefined;

  const mimeType = asset?.mimeType ?? "";
  const isVideo = mimeType.startsWith("video/") || src.toLowerCase().endsWith(".webm");
  const hotspots = courseAerialHotspots(course);
  const alt = course?.aerialMap?.alt?.trim() || undefined;

  return {
    src,
    alt,
    isVideo,
    hotspots,
  };
}

const courseLogoProjection = `
  courseLogo {
    alt,
    asset->{
      _id,
      url,
      mimeType
    }
  }
`;

const courseAerialMapProjection = `
  aerialMap {
    alt,
    asset->{
      _id,
      url,
      mimeType
    }
  },
  aerialHotspots[]{
    _key,
    holeNumber,
    x,
    y
  }
`;

const coursePagePanelsProjection = `
  pagePanels {
    aerial,
    courses,
    bookTeeTime,
    bookTeeTimeUrl,
    courseCount,
    courseSelections[]{
      _key,
      course->{
        title,
        "slug": slug.current
      }
    }
  }
`;

const courseScorecardProjection = `
  scorecard {
    hasWomenRatings,
    teeCount,
    teeSets[]{
      name,
      color,
      totalYards,
      totalPar {
        men,
        women
      },
      ratings {
        men { courseRating, slopeRating },
        women { courseRating, slopeRating }
      },
      courseRating,
      slopeRating
    },
    teeNames,
    holes[]{
      holeNumber,
      par {
        men,
        women
      },
      tees[]{
        par {
          men,
          women
        },
        yardage,
        handicap {
          men,
          women
        }
      },
      yardage,
      handicap
    }
  },
  scorecardHoles[]{
    holeNumber,
    par,
    tees[]{
      yardage,
      handicap
    },
    yardage,
    handicap
  }
`;

const coursesListQuery = defineQuery(`
  *[_type == "course" && defined(slug.current)] | order(_updatedAt desc) {
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    holeCount,
    ${courseLogoProjection},
    ${courseAerialMapProjection},
    ${coursePagePanelsProjection},
    ${courseScorecardProjection},
    holes[]{
      ${holeFlyoverProjection}
    }
  }
`);

const courseBySlugQuery = defineQuery(`
  *[_type == "course" && slug.current == $slug][0]{
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    holeCount,
    phone,
    googleMapsUrl,
    appleMapsUrl,
    address {
      line1,
      city,
      state,
      postalCode
    },
    seo {
      metaTitle,
      metaDescription,
      ogImage {
        alt,
        asset->{
          _id,
          url,
          metadata { dimensions { width, height, aspectRatio } }
        }
      }
    },
    ${courseLogoProjection},
    ${courseAerialMapProjection},
    ${coursePagePanelsProjection},
    ${courseScorecardProjection},
    holes[]{
      ${holeFlyoverProjection}
    }
  }
`);

const siteSettingsHeroListQuery = defineQuery(`
  *[_type == "siteSettings"] | order(_updatedAt desc) {
    _id,
    homeHeroVideo {
      ${muxAssetProjection}
    }
  }
`);

type SiteSettingsHeroRow = {
  _id: string;
  homeHeroVideo?: MuxVideoField;
};

export async function getSiteSettingsHeroUrls(): Promise<CoursePlaybackUrls | null> {
  const docs = await sanityClient.fetch(
    siteSettingsHeroListQuery,
    {},
    sanityFetchOptions(),
  );
  const list: SiteSettingsHeroRow[] = Array.isArray(docs) ? docs : [];
  const sorted = [...list].sort((a, b) => {
    const ak = a._id === "siteSettings" ? 1 : 0;
    const bk = b._id === "siteSettings" ? 1 : 0;
    return bk - ak;
  });
  if (process.env.NODE_ENV === "development" && sorted.length > 0) {
    console.info(
      "[birdseye] siteSettings candidates for home hero:",
      sorted.map((d) => ({
        _id: d._id,
        playbackId: d.homeHeroVideo?.asset?.playbackId ?? null,
      })),
    );
  }
  for (const doc of sorted) {
    const urls = muxVideoFieldUrls(doc.homeHeroVideo);
    if (urls) return urls;
  }
  return null;
}

/** Primary playback for a course page — active hole, or first hole with a video. */
export function coursePrimaryPlayback(
  course: CourseDoc | null,
  activeHole = 1,
): CoursePlaybackUrls | null {
  if (!course) return null;

  const holePlaybacks = courseHolePlaybacks(course);
  if (holePlaybacks.length === 0) return null;

  const match = holePlaybacks.find((h) => h.holeNumber === activeHole);
  return match ?? holePlaybacks[0] ?? null;
}

export async function getCoursesList(): Promise<CourseDoc[]> {
  return sanityClient.fetch(coursesListQuery, {}, sanityFetchOptions());
}

export async function getCourseBySlug(
  slug: string,
): Promise<CourseDoc | null> {
  return sanityClient.fetch(
    courseBySlugQuery,
    { slug },
    sanityFetchOptions(),
  );
}

/** Latest updated course — used for marketing homepage hero when Sanity has content */
export async function getLatestCourseForHero(): Promise<CourseDoc | null> {
  const list = await getCoursesList();
  return list[0] ?? null;
}

export async function getFirstPublishedSlug(): Promise<string | null> {
  const list = await getCoursesList();
  const withPlayback = list.find((c) => courseHasPlayableVideo(c));
  return withPlayback?.slug ?? list[0]?.slug ?? null;
}
