import { createClient } from "next-sanity";
import { buildCourseSeoDefaults } from "@/lib/seo/course-meta";

type CreateCourseStubInput = {
  title: string;
  slug: string;
  holeCount: number;
  clientId: string;
};

function getSanityWriteClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  if (!token || !projectId || !dataset) {
    throw new Error(
      "SANITY_API_WRITE_TOKEN is not configured. Add an Editor token from sanity.io/manage to .env.local.",
    );
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    token,
    useCdn: false,
  });
}

export async function findSanityCourseIdByClientIdAndSlug(
  clientId: string,
  slug: string,
) {
  const client = getSanityWriteClient();
  const existingId = await client.fetch<string | null>(
    `*[_type == "course" && clientId == $clientId && slug.current == $slug][0]._id`,
    { clientId, slug },
  );
  return existingId ?? null;
}

export async function findSanityCourseIdByClientId(clientId: string) {
  const client = getSanityWriteClient();
  const existingId = await client.fetch<string | null>(
    `*[_type == "course" && clientId == $clientId][0]._id`,
    { clientId },
  );
  return existingId ?? null;
}

export async function deleteSanityCourseById(documentId: string) {
  const client = getSanityWriteClient();
  await client.delete(documentId);
}

export async function createSanityCourseStub(input: CreateCourseStubInput) {
  const client = getSanityWriteClient();

  const existingId = await findSanityCourseIdByClientIdAndSlug(
    input.clientId,
    input.slug,
  );
  if (existingId) {
    return existingId;
  }

  const seo = buildCourseSeoDefaults({ title: input.title });

  const doc = await client.create({
    _type: "course",
    title: input.title,
    slug: { _type: "slug", current: input.slug },
    holeCount: input.holeCount,
    clientId: input.clientId,
    seo: {
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
    },
    pagePanels: {
      aerial: true,
      courses: false,
    },
  });

  return doc._id as string;
}
