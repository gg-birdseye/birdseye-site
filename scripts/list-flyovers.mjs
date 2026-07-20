import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "nrpde8qa",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-05-11",
  useCdn: true,
});

const query = `*[_type == "course" && defined(slug.current)]{
  title,
  "slug": slug.current,
  holes[]{
    holeNumber,
    flyoverVideo{ asset->{ playbackId, status } },
    flyoverFrames
  }
}`;

const courses = await client.fetch(query);
console.log(JSON.stringify(courses, null, 2));
