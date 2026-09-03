import { absoluteUrl } from "@/lib/seo/site";
import {
  andFilters,
  eventNameFilter,
  metricValue,
  pagePathFilter,
  runReport,
} from "@/lib/ga4/client";
import { formatRangeLabel, type DateRange } from "@/lib/ga4/dates";

export type NamedCount = {
  label: string;
  count: number;
};

export type DailyPoint = {
  date: string;
  visitors: number;
  sessions: number;
};

export type CourseAnalyticsReport = {
  courseTitle: string;
  courseSlug: string;
  pagePath: string;
  pageUrl: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  visitors: number;
  sessions: number;
  avgEngagementSeconds: number;
  bookTeeTimeClicks: number;
  daily: DailyPoint[];
  sources: NamedCount[];
  devices: NamedCount[];
  holes: NamedCount[];
  panels: NamedCount[];
  eventTotals: {
    holeSelects: number;
    panelOpens: number;
    aerialOpens: number;
    embedViews: number;
    embedCtaClicks: number;
  };
};

function dimensionRows(
  response: Awaited<ReturnType<typeof runReport>>,
  metricIndex = 0,
): NamedCount[] {
  return (response.rows ?? [])
    .flatMap((row) => (row ? [row] : []))
    .map((row) => {
      const label = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
      const raw = row.metricValues?.[metricIndex]?.value;
      const count = raw ? Number(raw) : 0;
      return { label, count: Number.isFinite(count) ? count : 0 };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

function formatHoleLabel(value: string) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return `Hole ${number}`;
  return value;
}

function formatPanelLabel(value: string) {
  if (value === "map" || value === "aerial") return "Aerial map";
  if (value === "scorecard") return "Scorecard";
  return value.replace(/[_-]+/g, " ");
}

function formatSourceLabel(value: string) {
  if (!value || value === "(not set)" || value === "(direct) / (none)") {
    return "Direct / QR / typed URL";
  }
  return value;
}

function formatDeviceLabel(value: string) {
  if (value === "desktop") return "Desktop";
  if (value === "mobile") return "Mobile";
  if (value === "tablet") return "Tablet";
  return value;
}

async function eventCount(slug: string, range: DateRange, eventName: string) {
  const response = await runReport({
    dateRanges: [range],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: andFilters(pagePathFilter(slug), eventNameFilter(eventName)),
  });
  return metricValue(response);
}

async function optionalBreakdown(
  slug: string,
  range: DateRange,
  eventName: string,
  dimension: string,
  formatLabel: (value: string) => string,
): Promise<NamedCount[]> {
  try {
    const response = await runReport({
      dateRanges: [range],
      dimensions: [{ name: dimension }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: andFilters(pagePathFilter(slug), eventNameFilter(eventName)),
      limit: 18,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });
    return dimensionRows(response).map((row) => ({
      label: formatLabel(row.label),
      count: row.count,
    }));
  } catch (error) {
    console.warn(
      `GA4 custom dimension ${dimension} unavailable:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function fetchCourseAnalyticsReport(options: {
  slug: string;
  title?: string | null;
  range: DateRange;
}): Promise<CourseAnalyticsReport> {
  const slug = options.slug.replace(/^\/+/, "").replace(/\/+$/, "");
  const range = options.range;
  const pathFilter = pagePathFilter(slug);

  const [
    overview,
    daily,
    sources,
    devices,
    bookTeeTimeClicks,
    holeSelects,
    panelOpens,
    aerialOpens,
    embedViews,
    embedCtaClicks,
    holes,
    panels,
  ] = await Promise.all([
    runReport({
      dateRanges: [range],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "userEngagementDuration" },
      ],
      dimensionFilter: pathFilter,
    }),
    runReport({
      dateRanges: [range],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      dimensionFilter: pathFilter,
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runReport({
      dateRanges: [range],
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: pathFilter,
      limit: 6,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runReport({
      dateRanges: [range],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: pathFilter,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    eventCount(slug, range, "book_tee_time_click"),
    eventCount(slug, range, "hole_select"),
    eventCount(slug, range, "panel_open"),
    eventCount(slug, range, "aerial_view_open"),
    eventCount(slug, range, "embed_view"),
    eventCount(slug, range, "embed_cta_click"),
    optionalBreakdown(
      slug,
      range,
      "hole_select",
      "customEvent:hole_number",
      formatHoleLabel,
    ),
    optionalBreakdown(slug, range, "panel_open", "customEvent:panel", formatPanelLabel),
  ]);

  const visitors = metricValue(overview, 0);
  const sessions = metricValue(overview, 1);
  const engagementDuration = metricValue(overview, 2);

  return {
    courseTitle: options.title?.trim() || slug,
    courseSlug: slug,
    pagePath: `/${slug}`,
    pageUrl: absoluteUrl(`/${slug}`),
    startDate: range.startDate,
    endDate: range.endDate,
    rangeLabel: formatRangeLabel(range),
    visitors,
    sessions,
    avgEngagementSeconds: visitors > 0 ? engagementDuration / visitors : 0,
    bookTeeTimeClicks,
    daily: (daily.rows ?? []).flatMap((row) => {
      if (!row) return [];
      const rawDate = row.dimensionValues?.[0]?.value ?? "";
      const ymd =
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;
      return [
        {
          date: ymd,
          visitors: Number(row.metricValues?.[0]?.value ?? 0) || 0,
          sessions: Number(row.metricValues?.[1]?.value ?? 0) || 0,
        },
      ];
    }),
    sources: dimensionRows(sources).map((row) => ({
      label: formatSourceLabel(row.label),
      count: row.count,
    })),
    devices: dimensionRows(devices).map((row) => ({
      label: formatDeviceLabel(row.label),
      count: row.count,
    })),
    holes,
    panels,
    eventTotals: {
      holeSelects,
      panelOpens,
      aerialOpens,
      embedViews,
      embedCtaClicks,
    },
  };
}
