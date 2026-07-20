"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { CourseContactInfo } from "@/lib/sanity/courses";

type Props = {
  courseTitle: string;
  contact: CourseContactInfo;
  /** When true, show the hole-info toggle in the menu. */
  showHoleInfoToggle: boolean;
  holeInfoOpen: boolean;
  onHoleInfoOpenChange: (open: boolean) => void;
  hidden?: boolean;
};

function MenuFace({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 72 72" className="course-video-menu-btn-svg" aria-hidden>
      <rect
        x="1"
        y="1"
        width="70"
        height="70"
        rx="6"
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="1.5"
      />
      {open ? (
        <g
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <path d="M24 24 L48 48" />
          <path d="M48 24 L24 48" />
        </g>
      ) : (
        <g fill="#fff">
          <rect x="20" y="24" width="32" height="4.5" rx="2.25" />
          <rect x="20" y="33.75" width="32" height="4.5" rx="2.25" />
          <rect x="20" y="43.5" width="32" height="4.5" rx="2.25" />
        </g>
      )}
    </svg>
  );
}

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && "ontouchend" in document)
  );
}

function mapsSearchUrl(address: string): string {
  const query = encodeURIComponent(address);
  if (isAppleDevice()) {
    return `https://maps.apple.com/?q=${query}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Prefer the platform-matched saved listing: Apple Maps link on iOS/macOS,
 * Google Maps link elsewhere. Fall back to an address search when the
 * matching link isn't set.
 */
function resolveMapsHref(contact: CourseContactInfo): string {
  const address = contact.addressLine ?? "";
  if (isAppleDevice()) {
    return contact.appleMapsUrl ?? mapsSearchUrl(address);
  }
  return contact.mapsUrl ?? mapsSearchUrl(address);
}

export function CourseMenuButton({
  courseTitle,
  contact,
  showHoleInfoToggle,
  holeInfoOpen,
  onHoleInfoOpenChange,
  hidden = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hasAddress = Boolean(contact.addressLine);
  const hasPhone = Boolean(contact.phone && contact.phoneHref);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div ref={rootRef} className="course-video-menu pointer-events-auto">
      <button
        type="button"
        className="course-video-menu-btn"
        aria-label={open ? "Close course menu" : "Open course menu"}
        aria-expanded={open}
        aria-controls={panelId}
        title="Course info"
        onClick={() => setOpen((value) => !value)}
      >
        <MenuFace open={open} />
      </button>

      {open ? (
        <div
          id={panelId}
          className="course-video-menu-panel"
          role="menu"
          aria-label={`${courseTitle} info`}
        >
          <p className="course-video-menu-title">{courseTitle}</p>

          {hasAddress && contact.addressLine ? (
            <a
              className="course-video-menu-link"
              href={resolveMapsHref(contact)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
            >
              <span className="course-video-menu-link-label">Address</span>
              <span className="course-video-menu-link-value">{contact.addressLine}</span>
            </a>
          ) : null}

          {hasPhone && contact.phone && contact.phoneHref ? (
            <a
              className="course-video-menu-link"
              href={contact.phoneHref}
              role="menuitem"
            >
              <span className="course-video-menu-link-label">Phone</span>
              <span className="course-video-menu-link-value">{contact.phone}</span>
            </a>
          ) : null}

          {showHoleInfoToggle ? (
            <button
              type="button"
              className="course-video-menu-toggle"
              role="menuitemcheckbox"
              aria-checked={holeInfoOpen}
              onClick={() => onHoleInfoOpenChange(!holeInfoOpen)}
            >
              <span className="course-video-menu-toggle-copy">
                <span className="course-video-menu-link-label">Hole info</span>
                <span className="course-video-menu-link-value">
                  Show/Hide
                </span>
              </span>
              <span
                className={`course-video-menu-switch${holeInfoOpen ? " is-on" : ""}`}
                aria-hidden
              >
                <span className="course-video-menu-switch-thumb" />
              </span>
            </button>
          ) : null}

          <Link
            className="course-video-menu-link"
            href="/refer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="course-video-menu-link-value">Refer a Course</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
