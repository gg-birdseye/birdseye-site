/**
 * List mux.videoAsset docs and whether any course still references them.
 * Usage: node --env-file=.env.local scripts/list-orphan-mux-assets.mjs
 */

import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-05-11",
  useCdn: false,
});

const assets = await client.fetch(
  `*[_type == "mux.videoAsset"]{
    _id,
    playbackId,
    _createdAt
  } | order(_createdAt asc)`,
);

const inUse = await client.fetch(
  `*[_type == "course"]{
    title,
    "slug": slug.current,
    "playbackIds": holes[].flyoverVideo.asset->playbackId
  }`,
);

const usedIds = new Set(
  inUse.flatMap((c) => c.playbackIds ?? []).filter(Boolean),
);

console.log(`Total mux.videoAsset: ${assets.length}`);
console.log(`In use by courses: ${usedIds.size}`);
console.log(`Mux Free Plan limit: 10 assets\n`);

for (const asset of assets) {
  const referenced = usedIds.has(asset.playbackId);
  console.log(
    `${referenced ? "IN USE" : "ORPHAN"}  ${asset.playbackId}  (${asset._id})`,
  );
}

const orphans = assets.filter((a) => !usedIds.has(a.playbackId));
console.log(`\n${orphans.length} orphan(s) safe to delete to free slots.`);
