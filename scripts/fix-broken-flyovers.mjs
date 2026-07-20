/**
 * Clear broken flyover video references and remove stale mux.videoAsset docs.
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-broken-flyovers.mjs --course course-two --holes 1,2
 *   npx sanity exec scripts/fix-broken-flyovers.mjs --with-user-token -- --course course-two --holes 1,2
 */

import { createClient } from "next-sanity";
import { getCliClient } from "sanity/cli";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const courseSlug =
  args[args.indexOf("--course") + 1] ?? process.env.FIX_COURSE;
const holesArg = args[args.indexOf("--holes") + 1] ?? process.env.FIX_HOLES;

if (!courseSlug || !holesArg) {
  console.error(
    "Usage: fix-broken-flyovers.mjs --course <slug> --holes 1,2 [--dry-run]",
  );
  process.exit(1);
}

const holeNumbers = holesArg.split(",").map((n) => Number.parseInt(n.trim(), 10));

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_WRITE_TOKEN;

let client;
if (token && projectId && dataset) {
  client = createClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-05-11",
    token,
    useCdn: false,
  });
} else {
  try {
    client = getCliClient({
      apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-05-11",
    });
  } catch {
    console.error(
      "Missing SANITY_API_WRITE_TOKEN — add to .env.local or run: npx sanity exec scripts/fix-broken-flyovers.mjs --with-user-token -- --course … --holes …",
    );
    process.exit(1);
  }
}

const course = await client.fetch(
  `*[_type == "course" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    holes[]{
      holeNumber,
      _key,
      flyoverVideo,
      flyoverFrames,
      "playbackId": flyoverVideo.asset->playbackId,
      "assetDocId": flyoverVideo.asset._ref
    }
  }`,
  { slug: courseSlug },
);

if (!course?._id) {
  console.error(`Course not found: ${courseSlug}`);
  process.exit(1);
}

const targets = (course.holes ?? []).filter((h) =>
  holeNumbers.includes(h.holeNumber),
);

if (targets.length === 0) {
  console.error(`No matching holes on ${course.title}`);
  process.exit(1);
}

console.info(`Course: ${course.title} (${course.slug})`);
for (const hole of targets) {
  console.info(
    `  Hole ${hole.holeNumber}: playbackId=${hole.playbackId ?? "none"} asset=${hole.assetDocId ?? "none"}`,
  );
}

if (dryRun) {
  console.info("\n[dry-run] Would unset flyoverVideo + flyoverFrames on these holes.");
  const assetIds = [
    ...new Set(targets.map((h) => h.assetDocId).filter(Boolean)),
  ];
  for (const id of assetIds) {
    console.info(`[dry-run] Would delete mux.videoAsset ${id}`);
  }
  process.exit(0);
}

let patch = client.patch(course._id);
for (const hole of targets) {
  const key = hole._key;
  if (key) {
    patch = patch.unset([
      `holes[_key=="${key}"].flyoverVideo`,
      `holes[_key=="${key}"].flyoverFrames`,
    ]);
  } else {
    patch = patch.unset([
      `holes[holeNumber==${hole.holeNumber}].flyoverVideo`,
      `holes[holeNumber==${hole.holeNumber}].flyoverFrames`,
    ]);
  }
}

await patch.commit();
console.info("\nCleared flyoverVideo on affected holes.");

const assetIds = [...new Set(targets.map((h) => h.assetDocId).filter(Boolean))];
for (const id of assetIds) {
  try {
    await client.delete(id);
    console.info(`Deleted mux.videoAsset ${id}`);
  } catch (err) {
    console.warn(`Could not delete ${id}:`, err.message ?? err);
  }
}

console.info("\nDone. Re-open Studio and upload fresh videos for those holes.");
