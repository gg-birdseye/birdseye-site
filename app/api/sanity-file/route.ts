import { NextResponse } from "next/server";

/**
 * Same-origin proxy for Sanity *file* assets (SVGs, etc.).
 * cdn.sanity.io/files returns 403 when the browser sends an Origin header
 * (e.g. CORS / crossOrigin image loads), which breaks hole aerial graphics
 * and canvas-based yardage masks on production hosts.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "Sanity project is not configured." },
      { status: 503 },
    );
  }

  if (target.protocol !== "https:" || target.hostname !== "cdn.sanity.io") {
    return NextResponse.json({ error: "Forbidden host." }, { status: 403 });
  }

  const allowedPrefix = `/files/${projectId}/`;
  if (!target.pathname.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: "Forbidden path." }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    // Do not forward browser Origin — Sanity file CDN 403s CORS requests.
    headers: { Accept: "*/*" },
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Upstream fetch failed." },
      { status: upstream.status || 502 },
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") ?? "application/octet-stream",
  );
  headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  // Allow canvas readback when the <img> uses crossOrigin="anonymous".
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new NextResponse(upstream.body, { status: 200, headers });
}
