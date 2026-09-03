import { BetaAnalyticsDataClient } from "@google-analytics/data";

type Ga4Credentials = {
  client_email: string;
  private_key: string;
};

export type Ga4Filter = {
  filter?: {
    fieldName: string;
    stringFilter?: {
      matchType: "EXACT";
      value: string;
    };
  };
  andGroup?: { expressions: Ga4Filter[] };
  orGroup?: { expressions: Ga4Filter[] };
};

type Ga4RunReportRequest = {
  dateRanges?: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  dimensionFilter?: Ga4Filter;
  limit?: number;
  orderBys?: Array<
    | { metric: { metricName: string }; desc?: boolean }
    | { dimension: { dimensionName: string }; desc?: boolean }
  >;
};

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string | null } | null> | null;
    metricValues?: Array<{ value?: string | null } | null> | null;
  } | null> | null;
};

let cachedClient: BetaAnalyticsDataClient | null = null;

export function isGa4Configured() {
  return Boolean(getPropertyId() && getCredentials());
}

export function getPropertyId(): string | null {
  const raw = process.env.GA4_PROPERTY_ID?.trim();
  if (!raw) return null;
  return raw.replace(/^properties\//, "");
}

function getCredentials(): Ga4Credentials | null {
  const json = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      return null;
    }
  }

  const email = process.env.GA4_CLIENT_EMAIL?.trim();
  const key = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (email && key) {
    return { client_email: email, private_key: key };
  }

  return null;
}

export function getGa4Client(): BetaAnalyticsDataClient {
  if (cachedClient) return cachedClient;
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error(
      "GA4 is not configured. Set GA4_PROPERTY_ID plus GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY.",
    );
  }
  cachedClient = new BetaAnalyticsDataClient({ credentials });
  return cachedClient;
}

export function pagePathFilter(slug: string): Ga4Filter {
  const path = slug.startsWith("/") ? slug : `/${slug}`;
  return {
    orGroup: {
      expressions: [
        {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: path },
          },
        },
        {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: `${path}/` },
          },
        },
      ],
    },
  };
}

export function andFilters(...filters: Ga4Filter[]): Ga4Filter {
  return { andGroup: { expressions: filters } };
}

export function eventNameFilter(eventName: string): Ga4Filter {
  return {
    filter: {
      fieldName: "eventName",
      stringFilter: { matchType: "EXACT", value: eventName },
    },
  };
}

export async function runReport(request: Ga4RunReportRequest) {
  const propertyId = getPropertyId();
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID is not configured.");
  }
  const [response] = await getGa4Client().runReport({
    property: `properties/${propertyId}`,
    ...request,
  });
  return response as Ga4RunReportResponse;
}

export function metricValue(
  response: Ga4RunReportResponse,
  metricIndex = 0,
  rowIndex = 0,
): number {
  const raw = response.rows?.[rowIndex]?.metricValues?.[metricIndex]?.value;
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
