/**
 * Extract frame sequences for every Mux flyover in Sanity that is missing
 * a local manifest at public/frames/{playbackId}/manifest.json.
 *
 * Usage:
 *   npm run extract-pending -- [--patch-sanity] [--dry-run]
 *
 * Run after uploading or replacing videos in Studio.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
const framesRoot =
  process.env.FRAMES_OUTPUT_DIR ?? join(rootDir, "public", "frames");

const patchSanity = process.argv.includes("--patch-sanity");
const dryRun = process.argv.includes("--dry-run");

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

if (!projectId || !dataset) {
  console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID or DATASET");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-05-11",
  useCdn: false,
});

const query = `*[_type == "course" && defined(slug.current)]{
  title,
  "slug": slug.current,
  holes[]{
    holeNumber,
    flyoverVideo{
      asset->{
        "playbackId": coalesce(playbackId, data.playback_ids[0].id),
        status
      }
    }
  }
}`;

const courses = await client.fetch(query);
const pending = [];

for (const course of courses) {
  for (const hole of course.holes ?? []) {
    const playbackId = hole.flyoverVideo?.asset?.playbackId;
    const status = hole.flyoverVideo?.asset?.status;
    if (!playbackId || status !== "ready") continue;

    const manifestPath = join(framesRoot, playbackId, "manifest.json");
    if (existsSync(manifestPath)) continue;

    pending.push({
      course: course.title ?? course.slug,
      hole: hole.holeNumber,
      playbackId,
    });
  }
}

if (pending.length === 0) {
  console.info("[extract-pending] All flyovers have frame manifests.");
  process.exit(0);
}

console.info(`[extract-pending] ${pending.length} flyover(s) need extraction:`);
for (const item of pending) {
  console.info(`  - ${item.course} hole ${item.hole}: ${item.playbackId}`);
}

if (dryRun) process.exit(0);

const extractScript = join(__dirname, "extract-frames.mjs");
let failed = 0;

for (const item of pending) {
  console.info(`\n[extract-pending] Extracting ${item.playbackId}…`);
  const args = [
    extractScript,
    "--playback-id",
    item.playbackId,
    "--from-mux",
  ];
  if (patchSanity) args.push("--patch-sanity");

  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: rootDir,
    env: process.env,
  });

  if (result.status !== 0) {
    failed++;
    console.error(`[extract-pending] Failed: ${item.playbackId}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
