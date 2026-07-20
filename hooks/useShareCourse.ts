"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ShareCoursePayload = {
  title: string;
  text: string;
  url: string;
};

export function buildCourseShareTitle(courseTitle: string, activeHole: number): string {
  const name = courseTitle.trim() || "Course";
  if (activeHole > 1) return `${name} — Hole ${activeHole}`;
  return name;
}

const DEFAULT_SHARE_TEXT =
  "Fly through this course before you arrive.";

export function useShareCourse() {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const flashCopied = useCallback(() => {
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const share = useCallback(
    async (payload: ShareCoursePayload) => {
      if (typeof window === "undefined") return;

      const shareData = {
        title: payload.title,
        text: payload.text,
        url: payload.url,
      };

      if (typeof navigator.share === "function") {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      try {
        await navigator.clipboard.writeText(payload.url);
        flashCopied();
      } catch {
        window.prompt("Copy this link:", payload.url);
      }
    },
    [flashCopied],
  );

  return { share, copied };
}

export { DEFAULT_SHARE_TEXT };
