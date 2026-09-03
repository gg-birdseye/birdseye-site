"use client";

import { useMemo, useState } from "react";

type CourseOption = {
  slug: string;
  title: string;
};

type PreviewResponse = {
  html?: string;
  error?: string;
  recipient?: {
    emails: string[];
    contactName: string | null;
  };
};

export function CourseAnalyticsAdmin({
  courses,
  ga4Configured,
}: {
  courses: CourseOption[];
  ga4Configured: boolean;
}) {
  const defaultSlug = courses[0]?.slug ?? "birchcreek";
  const [slug, setSlug] = useState(defaultSlug);
  const [preset, setPreset] = useState("last_30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [to, setTo] = useState("");
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ slug });
    if (preset === "last_month") params.set("preset", "last_month");
    if (preset === "custom" && startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    return params.toString();
  }, [endDate, preset, slug, startDate]);

  async function loadPreview() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/admin/analytics?${query}`);
      const result = (await response.json()) as PreviewResponse;
      if (!response.ok) throw new Error(result.error ?? "Preview failed.");
      setHtml(result.html ?? "");
      if (result.recipient?.emails.length && !to) {
        setTo(result.recipient.emails.join(", "));
      }
      setStatus("Preview loaded from Google Analytics.");
    } catch (err) {
      setHtml("");
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReport() {
    setSending(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/admin/analytics/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          preset: preset === "last_month" ? "last_month" : undefined,
          startDate: preset === "custom" ? startDate : undefined,
          endDate: preset === "custom" ? endDate : undefined,
          to,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        to?: string[];
      };
      if (!response.ok) throw new Error(result.error ?? "Send failed.");
      setStatus(`Sent to ${result.to?.join(", ") ?? to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  if (!ga4Configured) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm leading-6 text-stone-300">
        <p className="font-semibold text-white">Connect Google Analytics first</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>In Google Cloud, enable the Google Analytics Data API and create a service account.</li>
          <li>
            In GA4 → Admin → Property access management, add the service account
            email as Viewer.
          </li>
          <li>
            Copy the numeric Property ID from GA4 → Admin → Property settings
            (not the G- measurement ID).
          </li>
          <li>
            Add <code className="text-stone-100">GA4_PROPERTY_ID</code>,{" "}
            <code className="text-stone-100">GA4_CLIENT_EMAIL</code>, and{" "}
            <code className="text-stone-100">GA4_PRIVATE_KEY</code> to Vercel and{" "}
            <code className="text-stone-100">.env.local</code>, then restart the
            app.
          </li>
          <li>
            Optional: in GA4 → Admin → Custom definitions, register event-scoped
            dimensions <code className="text-stone-100">hole_number</code> and{" "}
            <code className="text-stone-100">panel</code> so reports can break
            out holes and feature usage.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-stone-300">
          Course
          <select
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white"
          >
            {courses.length === 0 ? (
              <option value="birchcreek">Birch Creek (/birchcreek)</option>
            ) : null}
            {courses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {course.title} (/{course.slug})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-stone-300">
          Date range
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white"
          >
            <option value="last_30">Last 30 days</option>
            <option value="last_month">Last calendar month</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      {preset === "custom" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-stone-300">
            Start
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white"
            />
          </label>
          <label className="block text-sm text-stone-300">
            End
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white"
            />
          </label>
        </div>
      ) : null}

      <label className="block text-sm text-stone-300">
        Send to (comma-separated)
        <input
          type="text"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="pro@course.com"
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="rounded-full border border-white/20 bg-birdseye-500 px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load preview"}
        </button>
        <button
          type="button"
          onClick={sendReport}
          disabled={sending || !to}
          className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send report"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {status ? <p className="text-sm text-stone-300">{status}</p> : null}

      {html ? (
        <iframe
          title="Course analytics report preview"
          srcDoc={html}
          className="min-h-[1100px] w-full rounded-2xl border border-white/10 bg-[#0a120e]"
        />
      ) : null}
    </div>
  );
}
