import type { ResponseQueryOptions } from "@sanity/client";
import { createClient } from "next-sanity";

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: true,
});

/** Next + Sanity: avoid stale homepage after Studio publish; fresher data in dev */
export function sanityFetchOptions(): ResponseQueryOptions {
  if (process.env.NODE_ENV === "development") {
    return {
      cache: "no-store",
      useCdn: false,
    };
  }
  return {
    next: { revalidate: 60 },
  };
}
