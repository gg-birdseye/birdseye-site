import { NextResponse } from "next/server";
import sharp from "sharp";
import { buildPlayableMaskFromRgba } from "@/lib/yardage-arcs";

export const runtime = "nodejs";

const MAX_EDGE = 720;

/**
 * Server-side playable-area mask for hole aerial yardage arcs.
 * Rasterizes the Sanity SVG/PNG with Sharp (no browser CORS issues).
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
  const pathMatch = target.pathname.match(/^\/files\/([^/]+)\//);
  const pathProjectId = pathMatch?.[1];
  const allowedProjectId = projectId || pathProjectId;

  if (target.protocol !== "https:" || target.hostname !== "cdn.sanity.io") {
    return NextResponse.json({ error: "Forbidden host." }, { status: 403 });
  }
  if (
    !allowedProjectId ||
    !target.pathname.startsWith(`/files/${allowedProjectId}/`)
  ) {
    return NextResponse.json({ error: "Forbidden path." }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "*/*" },
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream fetch failed." },
      { status: upstream.status || 502 },
    );
  }

  const input = Buffer.from(await upstream.arrayBuffer());

  try {
    // density helps SVG viewBox-only assets rasterize with real pixel sizes
    let pipeline = sharp(input, { density: 144 }).ensureAlpha();
    const meta = await pipeline.metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;

    if (srcW > MAX_EDGE || srcH > MAX_EDGE) {
      pipeline = sharp(input, { density: 144 })
        .ensureAlpha()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        });
    }

    const { data, info } = await pipeline
      .raw()
      .toBuffer({ resolveWithObject: true });

    const mask = buildPlayableMaskFromRgba(
      data,
      info.width,
      info.height,
      info.channels,
    );

    if (!mask) {
      return NextResponse.json(
        { error: "Could not build playable mask." },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        width: mask.width,
        height: mask.height,
        data: Buffer.from(mask.data).toString("base64"),
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.error("[hole-graphic-mask]", error);
    return NextResponse.json(
      { error: "Failed to rasterize hole graphic." },
      { status: 500 },
    );
  }
}
