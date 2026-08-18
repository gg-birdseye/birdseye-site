"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type GoogleAnalyticsWithUtmProps = {
  gaId: string;
  debugMode?: boolean;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function pageLocation(): string {
  return window.location.origin + window.location.pathname + window.location.search;
}

/**
 * GA4 attributes sessions from `page_location` (the full URL, including utm_*).
 * This init script sends that URL on the first hit, before any client navigation.
 */
function buildGaInitScript(gaId: string, debugMode: boolean): string {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${gaId}', {
  page_location: window.location.href,
  page_referrer: document.referrer${debugMode ? ",\n  debug_mode: true" : ""}
});`;
}

/**
 * Loads GA4 and always includes the query string on page_location so UTM
 * campaign tags populate Session source / medium and Session campaign.
 */
export function GoogleAnalyticsWithUtm({
  gaId,
  debugMode = false,
}: GoogleAnalyticsWithUtmProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialPath = useRef<string | null>(null);

  useEffect(() => {
    performance.mark("mark_feature_usage", {
      detail: { feature: "next-third-parties-ga" },
    });
  }, []);

  useEffect(() => {
    const search = searchParams.toString();
    const pathKey = search ? `${pathname}?${search}` : pathname;
    if (initialPath.current === null) {
      initialPath.current = pathKey;
      return;
    }
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_location: pageLocation(),
      page_path: pathKey,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return (
    <>
      <Script
        id="_next-ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: buildGaInitScript(gaId, debugMode),
        }}
      />
      <Script
        id="_next-ga"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
    </>
  );
}
