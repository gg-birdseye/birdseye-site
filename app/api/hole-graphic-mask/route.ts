import { NextResponse } from "next/server";
import {
  buildPlayableMaskFromSanityUrl,
  serializePlayableMask,
} from "@/lib/yardage-mask-server";

export const runtime = "nodejs";

/**
 * Server-side playable-area mask for hole aerial yardage arcs.
 * Prefer masks embedded in page props; this route remains as a fallback.
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

  try {
    const mask = await buildPlayableMaskFromSanityUrl(target.toString());
    if (!mask) {
      return NextResponse.json(
        { error: "Could not build playable mask." },
        { status: 422 },
      );
    }

    return NextResponse.json(serializePlayableMask(mask), {
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[hole-graphic-mask]", error);
    return NextResponse.json(
      { error: "Failed to rasterize hole graphic." },
      { status: 500 },
    );
  }
}
