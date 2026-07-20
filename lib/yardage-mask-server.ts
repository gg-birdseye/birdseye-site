import sharp from "sharp";
import {
  buildPlayableMaskFromRgba,
  sanityFileUrlFromGraphicSrc,
  type HoleGraphicPlayableMask,
} from "@/lib/yardage-arcs";

const MAX_EDGE = 720;

export type SerializedPlayableMask = {
  width: number;
  height: number;
  /** base64-encoded Uint8 mask (1 = playable) */
  data: string;
};

/**
 * Rasterize a Sanity CDN hole graphic and build a playable-area mask.
 * Runs only on the server (Sharp).
 */
export async function buildPlayableMaskFromSanityUrl(
  sanityFileUrl: string,
): Promise<HoleGraphicPlayableMask | null> {
  let target: URL;
  try {
    target = new URL(sanityFileUrl);
  } catch {
    return null;
  }

  if (target.protocol !== "https:" || target.hostname !== "cdn.sanity.io") {
    return null;
  }
  if (!target.pathname.startsWith("/files/")) return null;

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "*/*" },
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok) return null;

  const input = Buffer.from(await upstream.arrayBuffer());

  try {
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

    return buildPlayableMaskFromRgba(
      data,
      info.width,
      info.height,
      info.channels,
    );
  } catch (error) {
    console.error("[playable-mask] rasterize failed", sanityFileUrl, error);
    return null;
  }
}

export function serializePlayableMask(
  mask: HoleGraphicPlayableMask,
): SerializedPlayableMask {
  return {
    width: mask.width,
    height: mask.height,
    data: Buffer.from(mask.data).toString("base64"),
  };
}

/** Resolve CDN URL from a graphic src (proxy or direct) and build a mask. */
export async function buildSerializedPlayableMaskForGraphicSrc(
  graphicSrc: string,
): Promise<SerializedPlayableMask | null> {
  const sanityUrl = sanityFileUrlFromGraphicSrc(graphicSrc);
  if (!sanityUrl) return null;
  const mask = await buildPlayableMaskFromSanityUrl(sanityUrl);
  if (!mask) return null;
  return serializePlayableMask(mask);
}
