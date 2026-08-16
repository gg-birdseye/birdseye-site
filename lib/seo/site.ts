/** Preferred public origin (must match the host Vercel redirects to). */
export const DEFAULT_SITE_URL = "https://www.birdseye.golf";

/** Absolute site origin for canonical URLs, sitemap, and structured data. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = configured
    ? configured.replace(/\/$/, "")
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
      : DEFAULT_SITE_URL;

  // Apex → www so sitemap/canonicals match the live redirect target.
  try {
    const url = new URL(raw);
    if (url.hostname === "birdseye.golf") {
      url.hostname = "www.birdseye.golf";
      return url.origin;
    }
  } catch {
    // Fall through with the raw value.
  }

  return raw;
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
