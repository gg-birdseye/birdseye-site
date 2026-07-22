/** Last subheading row sticks at this viewport height (desktop). */
export const STACK_LAST_SLOT_VH = 68;

export const MOBILE_LANDSCAPE_MAX_WIDTH_PX = 940;
/** Compact row height for subheadings on mobile landscape. */
export const MOBILE_LANDSCAPE_SUBHEADING_ROW_VH = 12;

/** Gap between logo bottom and headline text when stuck. */
const LOGO_HEADLINE_GAP_PX = 10;
/** Extra lift for the stuck headline on mobile portrait (more room for bullets). */
const MOBILE_PORTRAIT_HEADLINE_LIFT_PX = 64;
/** Gap below the stuck headline before the first subheading (mobile portrait). */
const MOBILE_PORTRAIT_FIRST_SUBHEADING_GAP_PX = 22;
/** Vertical gap between subheadings on mobile portrait. */
const MOBILE_PORTRAIT_SUBHEADING_GAP_PX = 14;
/** Headline stick offset on mobile landscape (flush to top). */
const MOBILE_LANDSCAPE_HEADLINE_TOP_PX = 0;
/** Vertical gap between stacked subheadings on mobile landscape. */
const MOBILE_LANDSCAPE_SUBHEADING_GAP_PX = 20;

export function isMobileLandscape(): boolean {
  return window.matchMedia(
    `(max-width: ${MOBILE_LANDSCAPE_MAX_WIDTH_PX}px) and (orientation: landscape)`,
  ).matches;
}

function isMobilePortrait(): boolean {
  return window.matchMedia("(max-width: 767px) and (orientation: portrait)")
    .matches;
}

export function isMobilePortraitLayout(): boolean {
  return isMobilePortrait();
}

export function subheadingSlotHeightVh(defaultSlotVh: number): number {
  if (isMobileLandscape()) {
    return MOBILE_LANDSCAPE_SUBHEADING_ROW_VH;
  }
  return defaultSlotVh;
}

export function measureLogoBottomPx(): number | null {
  const logo = document.querySelector<HTMLElement>(".site-logo-header-img");
  if (!logo) return null;
  return logo.getBoundingClientRect().bottom;
}

function measureHeadlineLine2BottomPx(): number {
  const line2 = document.querySelector<HTMLElement>(
    '[data-scroll-reveal-line="2"]',
  );
  if (line2) {
    return line2.getBoundingClientRect().bottom;
  }
  return measureHeadlineStickTopPx() + 64;
}

/** Top offset for line 2 when the headline is stuck. */
export function measureHeadlineStickTopPx(): number {
  if (isMobileLandscape()) {
    return MOBILE_LANDSCAPE_HEADLINE_TOP_PX;
  }

  const logoBottom = measureLogoBottomPx();
  if (logoBottom != null) {
    const top = logoBottom + LOGO_HEADLINE_GAP_PX;
    if (isMobilePortrait()) {
      return top - MOBILE_PORTRAIT_HEADLINE_LIFT_PX;
    }
    return top;
  }

  return window.innerHeight * (isMobilePortrait() ? 0.1 : 0.22);
}

function measurePortraitSubheadingStepPx(): number {
  const ovals = document.querySelectorAll<HTMLElement>(".scroll-reveal-oval");
  let maxHeight = 0;

  ovals.forEach((oval) => {
    maxHeight = Math.max(maxHeight, oval.getBoundingClientRect().height);
  });

  if (maxHeight <= 0) {
    maxHeight = window.innerHeight * 0.055;
  }

  return maxHeight + MOBILE_PORTRAIT_SUBHEADING_GAP_PX;
}

function measureMobilePortraitSubheadingSlotTopsPx(
  subheadingCount: number,
): number[] {
  const firstTop =
    measureHeadlineLine2BottomPx() + MOBILE_PORTRAIT_FIRST_SUBHEADING_GAP_PX;
  const step = measurePortraitSubheadingStepPx();

  return Array.from(
    { length: subheadingCount },
    (_, index) => firstTop + step * index,
  );
}

function measureMobileLandscapeSubheadingSlotTopsPx(
  subheadingCount: number,
): number[] {
  const rowHeightPx =
    window.innerHeight * (MOBILE_LANDSCAPE_SUBHEADING_ROW_VH / 100);
  let nextTop = measureHeadlineLine2BottomPx() + MOBILE_LANDSCAPE_SUBHEADING_GAP_PX;

  return Array.from({ length: subheadingCount }, () => {
    const top = nextTop;
    nextTop += rowHeightPx + MOBILE_LANDSCAPE_SUBHEADING_GAP_PX;
    return top;
  });
}

/** Subheading row tops: equal spacing from the stuck headline downward. */
export function measureSubheadingSlotTopsPx(
  subheadingCount: number,
  headlineStickTopPx = measureHeadlineStickTopPx(),
): number[] {
  if (subheadingCount <= 0) return [];

  if (isMobileLandscape()) {
    return measureMobileLandscapeSubheadingSlotTopsPx(subheadingCount);
  }

  if (isMobilePortrait()) {
    return measureMobilePortraitSubheadingSlotTopsPx(subheadingCount);
  }

  const lastTop = window.innerHeight * (STACK_LAST_SLOT_VH / 100);

  if (subheadingCount === 1) {
    return [lastTop];
  }

  const step = (lastTop - headlineStickTopPx) / subheadingCount;

  return Array.from({ length: subheadingCount }, (_, index) => {
    if (index === subheadingCount - 1) return lastTop;
    return headlineStickTopPx + step * (index + 1);
  });
}

export function subheadingSlotTopPx(
  index: number,
  subheadingCount: number,
  slotTops = measureSubheadingSlotTopsPx(subheadingCount),
): number {
  if (isMobileLandscape()) {
    return (
      slotTops[index] ??
      measureHeadlineLine2BottomPx() + MOBILE_LANDSCAPE_SUBHEADING_GAP_PX
    );
  }

  if (isMobilePortrait()) {
    return (
      slotTops[index] ??
      measureHeadlineLine2BottomPx() + MOBILE_PORTRAIT_FIRST_SUBHEADING_GAP_PX
    );
  }

  return slotTops[index] ?? window.innerHeight * (STACK_LAST_SLOT_VH / 100);
}
