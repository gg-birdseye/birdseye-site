/**
 * Extract scroll-scrub frames from a video and write manifest + image sequence.
 *
 * Usage:
 *   node scripts/extract-frames.mjs --playback-id ID --from-mux [--patch-sanity]
 *   node scripts/extract-frames.mjs --playback-id ID --input path/to/video.mp4 [--patch-sanity]
 *
 * Requires ffmpeg on PATH.
 *
 * Defaults: 4 frames/sec of footage (~48 frames for 12s par 3, ~128 for 32s par 5),
 * 1280px wide, WebP ~75 KB/frame.
 *
 * Env (optional):
 *   FRAMES_SAMPLE_FPS    — extraction rate (default 4)
 *   FRAMES_MIN_FRAMES    — floor on frame count (default 40, 0 = off)
 *   FRAMES_MAX_FRAMES    — ceiling on frame count (default 150, 0 = off)
 *   FRAMES_MAX_WIDTH     — max output width (default 1280)
 *   FRAMES_WEBP_QUALITY  — WebP quality 0–100 (default 78)
 *   FRAMES_FORMAT        — webp | jpeg (default webp)
 *   FRAMES_OUTPUT_DIR    — default public/frames
 *   FRAMES_PUBLIC_BASE_URL — default /frames
 *
 * CLI: --sample-fps 4
 */

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "next-sanity";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const envPath = join(rootDir, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key] != null) continue;
    process.env[key] = match[2].trim().replace(/^"|"$/g, "");
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

function requireFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error("ffmpeg not found on PATH — install ffmpeg to extract frames.");
  }
}

function downloadMuxMp4(playbackId, destPath) {
  const url = `https://stream.mux.com/${playbackId}/highest.mp4`;
  const result = spawnSync("curl", ["-fsSL", url, "-o", destPath], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to download Mux MP4 for ${playbackId}`);
  }
}

function probeDuration(inputPath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ],
    { encoding: "utf8" },
  );
  const duration = Number.parseFloat(result.stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

/** Fixed sample rate with optional min/max frame count (even time spacing). */
function effectiveSampleFps(
  durationSec,
  sampleFps,
  minFrames,
  maxFrames,
) {
  let count = Math.max(1, Math.round(durationSec * sampleFps));
  if (minFrames > 0) count = Math.max(minFrames, count);
  if (maxFrames > 0) count = Math.min(maxFrames, count);
  return { sampleFps: count / durationSec, frameCount: count };
}

function extractFrames(inputPath, outDir, sampleFps, maxWidth, format, quality) {
  mkdirSync(outDir, { recursive: true });
  const ext = format === "jpeg" ? "jpg" : "webp";
  const pattern = join(outDir, `%05d.${ext}`);
  const vf = `fps=${sampleFps.toFixed(4)},scale='min(${maxWidth},iw)':-2`;

  const ffmpegArgs = [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-vf",
    vf,
    "-start_number",
    "1",
    "-f",
    "image2",
  ];

  if (format === "webp") {
    ffmpegArgs.push(
      "-c:v",
      "libwebp",
      "-quality",
      String(quality),
      "-compression_level",
      "4",
    );
  } else {
    ffmpegArgs.push("-q:v", String(Math.round((100 - quality) / 3 + 2)));
  }

  ffmpegArgs.push(pattern);

  const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("ffmpeg frame extraction failed");
  }
}

function probeDimensions(inputPath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0:s=x",
      inputPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return { width: 1280, height: 720 };
  const [w, h] = result.stdout.trim().split("x").map(Number);
  return {
    width: Number.isFinite(w) ? w : 1280,
    height: Number.isFinite(h) ? h : 720,
  };
}

function scaledDimensions(srcW, srcH, maxWidth) {
  if (srcW <= maxWidth) return { width: srcW, height: srcH };
  const width = maxWidth;
  const height = Math.round((srcH * maxWidth) / srcW);
  return { width, height: height - (height % 2) };
}

function frameFilePattern(format) {
  return format === "jpeg" ? /^\d{5}\.jpg$/ : /^\d{5}\.webp$/;
}

function summarizeFrameSizes(outDir, frameFiles) {
  if (frameFiles.length === 0) return;
  const bytes = frameFiles.map((f) => statSync(join(outDir, f)).size);
  const total = bytes.reduce((a, b) => a + b, 0);
  const avgKb = total / frameFiles.length / 1024;
  const minKb = Math.min(...bytes) / 1024;
  const maxKb = Math.max(...bytes) / 1024;
  console.info(
    `[extract-frames] Size: ${(total / 1024 / 1024).toFixed(1)} MB total, ` +
      `${avgKb.toFixed(0)} KB avg (${minKb.toFixed(0)}–${maxKb.toFixed(0)} KB per frame)`,
  );
}

async function patchSanity(playbackId, manifest, baseUrl) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!projectId || !dataset || !token) {
    console.warn("[extract-frames] Skipping Sanity patch — missing write token.");
    return;
  }

  const siteOrigin =
    process.env.FRAMES_MANIFEST_ORIGIN ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  // Prefer same-origin relative paths so local + production both resolve
  // against the site that serves public/frames. Absolute only when forced.
  const forceAbsolute = process.env.FRAMES_MANIFEST_ABSOLUTE === "1";
  const manifestUrl =
    baseUrl.startsWith("http")
      ? `${baseUrl}/manifest.json`
      : forceAbsolute && siteOrigin
        ? `${siteOrigin.replace(/\/$/, "")}${baseUrl}/manifest.json`
        : `${baseUrl}/manifest.json`;

  if (!manifestUrl.startsWith("http") && !manifestUrl.startsWith("/")) {
    console.warn(
      `[extract-frames] Unexpected manifestUrl format: ${manifestUrl}`,
    );
  } else {
    console.info(`[extract-frames] Sanity manifestUrl → ${manifestUrl}`);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2024-01-01",
    token,
    useCdn: false,
  });

  const match = await client.fetch(
    `*[_type == "course" && count(holes[flyoverVideo.asset->playbackId == $playbackId]) > 0][0]{
      _id,
      "holeNumber": holes[flyoverVideo.asset->playbackId == $playbackId][0].holeNumber
    }`,
    { playbackId },
  );

  if (!match?._id || !match.holeNumber) {
    console.warn(
      `[extract-frames] No Sanity course hole for playbackId ${playbackId}`,
    );
    return;
  }

  await client
    .patch(match._id)
    .set({
      [`holes[holeNumber==${match.holeNumber}].flyoverFrames`]: {
        status: "ready",
        manifestUrl,
        frameCount: manifest.frameCount,
        fps: manifest.fps,
        version: Date.now(),
      },
    })
    .commit();

  console.info(
    `[extract-frames] Patched course ${match._id} hole ${match.holeNumber}`,
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const playbackId = args["playback-id"];
  const input = args.input;
  const fromMux = Boolean(args["from-mux"]);
  const patchSanityFlag = Boolean(args["patch-sanity"]);

  if (!playbackId) {
    console.error("Missing --playback-id");
    process.exit(1);
  }

  requireFfmpeg();

  const sampleFpsNominal = Number(
    args["sample-fps"] ?? process.env.FRAMES_SAMPLE_FPS ?? 4,
  );
  const minFrames = Number(process.env.FRAMES_MIN_FRAMES ?? 40);
  const maxFrames = Number(process.env.FRAMES_MAX_FRAMES ?? 150);
  const maxWidth = Number(process.env.FRAMES_MAX_WIDTH ?? 1280);
  const quality = Number(process.env.FRAMES_WEBP_QUALITY ?? 78);
  const format = (process.env.FRAMES_FORMAT ?? "webp").toLowerCase();
  const outputRoot =
    process.env.FRAMES_OUTPUT_DIR ?? join(rootDir, "public", "frames");
  const publicBase = (process.env.FRAMES_PUBLIC_BASE_URL ?? "/frames").replace(
    /\/$/,
    "",
  );
  const outDir = join(outputRoot, playbackId);

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const tempInput = join(outDir, "_source.mp4");
  let sourcePath = input;

  if (fromMux) {
    downloadMuxMp4(playbackId, tempInput);
    sourcePath = tempInput;
  }

  if (!sourcePath) {
    console.error("Provide --input path/to/video.mp4 or --from-mux");
    process.exit(1);
  }

  const duration = probeDuration(sourcePath);
  if (!duration) {
    throw new Error("Could not read video duration");
  }

  const { sampleFps, frameCount: expectedFrames } = effectiveSampleFps(
    duration,
    sampleFpsNominal,
    minFrames,
    maxFrames,
  );
  const srcDims = probeDimensions(sourcePath);
  const dims = scaledDimensions(srcDims.width, srcDims.height, maxWidth);

  const clampNote =
    expectedFrames !== Math.round(duration * sampleFpsNominal)
      ? ` (clamped to ${expectedFrames} frames)`
      : "";
  console.info(
    `[extract-frames] Duration ${duration.toFixed(1)}s → ~${expectedFrames} frames ` +
      `at ${sampleFpsNominal} fps${clampNote}, max ${maxWidth}px, ${format} q${quality}`,
  );

  extractFrames(sourcePath, outDir, sampleFps, maxWidth, format, quality);

  if (existsSync(tempInput)) {
    rmSync(tempInput, { force: true });
  }

  const frameFiles = readdirSync(outDir)
    .filter((f) => frameFilePattern(format).test(f))
    .sort();
  const frameCount = frameFiles.length;

  if (frameCount === 0) {
    throw new Error("No frames extracted");
  }

  summarizeFrameSizes(outDir, frameFiles);

  const baseUrl = `${publicBase}/${playbackId}`;
  const manifest = {
    version: 1,
    playbackId,
    /** Nominal extraction rate (frames per second of source footage). */
    fps: sampleFpsNominal,
    frameCount,
    width: dims.width,
    height: dims.height,
    format: format === "jpeg" ? "jpeg" : "webp",
    baseUrl,
  };

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.info(`[extract-frames] Wrote ${frameCount} frames → ${outDir}`);
  console.info(`[extract-frames] Manifest baseUrl: ${baseUrl}`);

  if (patchSanityFlag) {
    await patchSanity(playbackId, manifest, baseUrl);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
