/**
 * Quick diagnostics for Mux upload issues in Sanity.
 * Usage: node --env-file=.env.local scripts/debug-mux-upload.mjs
 */

import { createClient } from "next-sanity";

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

const muxSecret = await client.fetch(`*[_id == "secrets.mux"][0]{_id, _rev}`);
const exampleCourse = await client.fetch(
  `*[_type == "course" && slug.current == "example-course"][0]{
    _id,
    title,
    holeCount,
    "holeCountActual": count(holes),
    "holesWithVideo": count(holes[defined(flyoverVideo.asset)]),
    holes[]{
      holeNumber,
      _key,
      "hasVideo": defined(flyoverVideo.asset),
      "videoStatus": flyoverVideo.asset->status,
      "filename": flyoverVideo.asset->filename,
      "playbackId": flyoverVideo.asset->playbackId
    }
  }`,
);

const recentMuxAssets = await client.fetch(
  `*[_type == "mux.videoAsset"] | order(_createdAt desc)[0...8]{
    _id,
    _createdAt,
    filename,
    status,
    playbackId,
    "error": data.errors[0].message
  }`,
);

console.log("=== Mux credentials in Sanity ===");
console.log(
  muxSecret
    ? `secrets.mux document exists (rev ${muxSecret._rev})`
    : "MISSING secrets.mux — re-enter Mux token in Studio (Mux API Credentials)",
);

console.log("\n=== Example Course holes ===");
console.log(JSON.stringify(exampleCourse, null, 2));

console.log("\n=== Recent mux.videoAsset documents ===");
console.log(JSON.stringify(recentMuxAssets, null, 2));

const failedAssets = await client.fetch(
  `*[_type == "mux.videoAsset" && status != "ready"]{
    _id,
    _createdAt,
    filename,
    status,
    playbackId,
    "error": data.errors[0].message
  }`,
);

console.log("\n=== Non-ready mux.videoAsset documents ===");
console.log(
  failedAssets.length
    ? JSON.stringify(failedAssets, null, 2)
    : "None — no stuck/failed Mux assets in Sanity",
);

const assetCount = await client.fetch(`count(*[_type == "mux.videoAsset"])`);
const allAssets = await client.fetch(
  `*[_type == "mux.videoAsset"] | order(_createdAt asc){
    _id,
    _createdAt,
    playbackId,
    status
  }`,
);

console.log(`\n=== Total mux.videoAsset count: ${assetCount} ===`);
console.log(
  assetCount >= 10
    ? "⚠️  Mux Free Plan allows 10 stored assets — you may be at or over the limit."
    : `${10 - assetCount} slot(s) left before Mux Free Plan 10-asset cap (if on free plan).`,
);
console.log(JSON.stringify(allAssets, null, 2));
