import { spawn } from "node:child_process";
import { join } from "node:path";

/** Fire-and-forget local frame extraction (dev machine with ffmpeg). */
export function spawnLocalFrameExtraction(
  playbackId: string,
  options: { patchSanity?: boolean } = {},
): void {
  const rootDir = process.cwd();
  const script = join(rootDir, "scripts", "extract-frames.mjs");
  const args = [
    script,
    "--playback-id",
    playbackId,
    "--from-mux",
  ];
  if (options.patchSanity) args.push("--patch-sanity");

  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  console.info(
    "[frame-extraction] Spawned local extract for",
    playbackId,
  );
}
