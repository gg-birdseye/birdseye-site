import { randomBytes } from "node:crypto";

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function slugifyCourseName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
