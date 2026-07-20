import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { spawnLocalFrameExtraction } from "@/lib/frame-extraction/spawn-local";
import {
  setFlyoverFramesProcessing,
} from "@/lib/frame-extraction/sanity-patch";

/** Mux webhook — marks frame extraction as processing and forwards to worker. */
export async function POST(request: Request) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "MUX_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("mux-signature");

  if (!signature || !verifyMuxSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    data?: { id?: string; playback_ids?: Array<{ id?: string }> };
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? "";
  const playbackId =
    payload.data?.playback_ids?.[0]?.id ??
    (payload.data as { playback_id?: string } | undefined)?.playback_id;

  const shouldExtract =
    eventType === "video.asset.static_rendition.ready" ||
    eventType === "video.asset.ready";

  if (!shouldExtract || !playbackId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    await setFlyoverFramesProcessing(playbackId);
  } catch (err) {
    console.warn("[mux/webhook] Sanity processing patch failed", err);
  }

  const extractorUrl = process.env.FRAME_EXTRACTOR_URL;
  const runLocal = process.env.FRAME_EXTRACTOR_RUN_LOCAL === "1";

  if (extractorUrl) {
    const secret = process.env.FRAME_EXTRACTOR_SECRET;
    void fetch(extractorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ playbackId, assetId: payload.data?.id }),
    }).catch((err) => {
      console.error("[mux/webhook] Frame extractor forward failed", err);
    });
  } else if (runLocal) {
    spawnLocalFrameExtraction(playbackId, {
      patchSanity: Boolean(process.env.SANITY_API_WRITE_TOKEN),
    });
  } else {
    console.info(
      "[mux/webhook] No FRAME_EXTRACTOR_URL or FRAME_EXTRACTOR_RUN_LOCAL — run:",
      `npm run extract-pending`,
      "or",
      `node scripts/extract-frames.mjs --playback-id ${playbackId} --from-mux`,
    );
  }

  return NextResponse.json({ ok: true, playbackId });
}

/** @see https://docs.mux.com/guides/system/listen-for-webhooks#verify-webhook-signatures */
function verifyMuxSignature(
  rawBody: string,
  header: string,
  secret: string,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, v] = part.trim().split("=");
      return [k, v];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  try {
    const payload = `${parts.t}.${rawBody}`;
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return timingSafeEqual(
      Buffer.from(parts.v1, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}
