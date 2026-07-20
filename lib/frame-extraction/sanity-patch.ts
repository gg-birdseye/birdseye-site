import { createClient, type SanityClient } from "next-sanity";

export type FlyoverFramesPatch = {
  status: "processing" | "ready" | "failed";
  manifestUrl?: string;
  frameCount?: number;
  fps?: number;
  version?: number;
};

export function createSanityWriteClient(): SanityClient {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!projectId || !dataset || !token) {
    throw new Error(
      "Missing NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, or SANITY_API_WRITE_TOKEN",
    );
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2024-01-01",
    token,
    useCdn: false,
  });
}

type CourseHoleMatch = {
  _id: string;
  holeNumber: number;
};

export async function findCourseHoleByPlaybackId(
  client: SanityClient,
  playbackId: string,
): Promise<CourseHoleMatch | null> {
  return client.fetch(
    `*[_type == "course" && count(holes[flyoverVideo.asset->playbackId == $playbackId]) > 0][0]{
      _id,
      "holeNumber": holes[flyoverVideo.asset->playbackId == $playbackId][0].holeNumber
    }`,
    { playbackId },
  );
}

export async function patchHoleFlyoverFrames(
  client: SanityClient,
  courseId: string,
  holeNumber: number,
  frames: FlyoverFramesPatch,
): Promise<void> {
  await client
    .patch(courseId)
    .set({
      [`holes[holeNumber==${holeNumber}].flyoverFrames`]: frames,
    })
    .commit();
}

export async function setFlyoverFramesProcessing(
  playbackId: string,
): Promise<CourseHoleMatch | null> {
  const client = createSanityWriteClient();
  const match = await findCourseHoleByPlaybackId(client, playbackId);
  if (!match?.holeNumber) return null;

  await patchHoleFlyoverFrames(client, match._id, match.holeNumber, {
    status: "processing",
  });

  return match;
}

export async function setFlyoverFramesReady(
  playbackId: string,
  data: {
    manifestUrl: string;
    frameCount: number;
    fps: number;
    version?: number;
  },
): Promise<void> {
  const client = createSanityWriteClient();
  const match = await findCourseHoleByPlaybackId(client, playbackId);
  if (!match?.holeNumber) {
    throw new Error(`No course hole found for playbackId ${playbackId}`);
  }

  await patchHoleFlyoverFrames(client, match._id, match.holeNumber, {
    status: "ready",
    manifestUrl: data.manifestUrl,
    frameCount: data.frameCount,
    fps: data.fps,
    version: data.version ?? Date.now(),
  });
}

export async function setFlyoverFramesFailed(
  playbackId: string,
): Promise<void> {
  const client = createSanityWriteClient();
  const match = await findCourseHoleByPlaybackId(client, playbackId);
  if (!match?.holeNumber) return;

  await patchHoleFlyoverFrames(client, match._id, match.holeNumber, {
    status: "failed",
  });
}
