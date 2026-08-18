"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const UTM_STORAGE_KEY = "birdseye_utm";

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

function buildGaInitScript(gaId: string, debugMode: boolean): string {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());

(function () {
  var params = new URLSearchParams(window.location.search);
  var map = {
    utm_source: "campaign_source",
    utm_medium: "campaign_medium",
    utm_campaign: "campaign_name",
    utm_content: "campaign_content",
    utm_term: "campaign_term",
  };
  var cfg = {};
  var key;
  for (key in map) {
    var val = params.get(key);
    if (val) cfg[map[key]] = val;
  }
  try {
    if (Object.keys(cfg).length > 0) {
      sessionStorage.setItem("${UTM_STORAGE_KEY}", JSON.stringify(cfg));
    } else {
      var stored = sessionStorage.getItem("${UTM_STORAGE_KEY}");
      if (stored) cfg = JSON.parse(stored);
    }
  } catch (e) {}
  ${debugMode ? "cfg.debug_mode = true;" : ""}
  gtag("config", "${gaId}", cfg);
})();`;
}

function readStoredCampaignConfig(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Loads GA4 and forwards utm_* query params into gtag campaign fields on the
 * first config call (before the initial page_view). Stored for the tab session
 * so client-side navigations keep the same attribution.
 */
export function GoogleAnalyticsWithUtm({
  gaId,
  debugMode = false,
}: GoogleAnalyticsWithUtmProps) {
  const pathname = usePathname();

  useEffect(() => {
    performance.mark("mark_feature_usage", {
      detail: { feature: "next-third-parties-ga" },
    });
  }, []);

  useEffect(() => {
    const cfg = readStoredCampaignConfig();
    if (Object.keys(cfg).length === 0 || typeof window.gtag !== "function") return;
    window.gtag("config", gaId, cfg);
  }, [gaId, pathname]);

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
