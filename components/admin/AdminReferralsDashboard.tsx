"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Referral } from "@/lib/db/schema";
import { formatUsPhoneFromDigits } from "@/lib/format-phone";
import {
  GIFT_CARD_LABELS,
  REFERRAL_RELEASE_REASON_LABELS,
  REFERRAL_RELEASE_REASONS,
  REFERRAL_VERIFY_WINDOW_DAYS,
} from "@/lib/referrals/domain";

const STATUS_LABELS: Record<string, string> = {
  pending_verify: "Pending verification",
  qualified: "Qualified",
  released: "Released",
  won: "Won",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending_verify: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  qualified: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  released: "bg-stone-500/15 text-stone-400 border-stone-400/30",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
};

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function verifyDeadline(referral: Referral) {
  const deadline = new Date(referral.createdAt);
  deadline.setDate(deadline.getDate() + REFERRAL_VERIFY_WINDOW_DAYS);
  return deadline;
}

export function AdminReferralsDashboard() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/referrals");
      const data = (await response.json()) as {
        referrals?: Referral[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Failed to load referrals.");
      setReferrals(data.referrals ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load referrals.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (
      referral: Referral,
      action: string,
      extra: Record<string, unknown> = {},
    ) => {
      setActionError("");
      setBusyId(referral.id);
      try {
        const response = await fetch(`/api/admin/referrals/${referral.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = (await response.json()) as {
          referral?: Referral;
          error?: string;
        };
        if (!response.ok || !data.referral) {
          throw new Error(data.error ?? "Action failed.");
        }
        setReferrals((rows) =>
          rows.map((row) => (row.id === data.referral!.id ? data.referral! : row)),
        );
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const handleRelease = useCallback(
    (referral: Referral) => {
      const choice = window.prompt(
        `Release reason:\n${REFERRAL_RELEASE_REASONS.map(
          (reason, index) => `${index + 1}. ${reason.label}`,
        ).join("\n")}\n\nEnter a number (1-${REFERRAL_RELEASE_REASONS.length}):`,
        "1",
      );
      if (choice == null) return;
      const index = Number(choice.trim()) - 1;
      const reason =
        REFERRAL_RELEASE_REASONS[index]?.value ?? "released_by_admin";
      const notify = window.confirm(
        "Email the referrer that this referral was released?",
      );
      void runAction(referral, "release", {
        releaseReason: reason,
        sendEmail: notify,
      });
    },
    [runAction],
  );

  const handleFulfill = useCallback(
    (referral: Referral) => {
      const reference = window.prompt(
        "Gift card order / reference number (optional):",
        referral.rewardReference ?? "",
      );
      if (reference == null) return;
      void runAction(referral, "fulfill", { rewardReference: reference });
    },
    [runAction],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter((referral) => referral.status === statusFilter);
  }, [referrals, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const referral of referrals) {
      map[referral.status] = (map[referral.status] ?? 0) + 1;
    }
    return map;
  }, [referrals]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            REFERRALS
          </h1>
          <p className="mt-2 text-stone-400">
            Verify club contacts, then qualify, release, or mark referrals won.
            Pending referrals auto-release after {REFERRAL_VERIFY_WINDOW_DAYS} days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="referral-status-filter" className="text-sm text-stone-400">
            Status
          </label>
          <select
            id="referral-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="all">All ({referrals.length})</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({counts[value] ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <p className="mt-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-300">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="mt-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-300">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-stone-400">Loading referrals…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-stone-400">No referrals yet.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {filtered.map((referral) => {
            const busy = busyId === referral.id;
            return (
              <div
                key={referral.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">
                        {referral.courseName}
                      </h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGE_CLASSES[referral.status] ??
                          STATUS_BADGE_CLASSES.released
                        }`}
                      >
                        {STATUS_LABELS[referral.status] ?? referral.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-400">
                      {referral.courseCity}, {referral.courseState} ·{" "}
                      {referral.holeCount} holes · Submitted{" "}
                      {formatDate(referral.createdAt)}
                      {referral.status === "pending_verify"
                        ? ` · Auto-releases ${formatDate(verifyDeadline(referral))}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-white">
                      ${referral.rewardAmountDollars}{" "}
                      {GIFT_CARD_LABELS[referral.giftCardChoice] ??
                        referral.giftCardChoice}{" "}
                      e-gift card
                    </p>
                    {referral.status === "won" ? (
                      <p className="mt-0.5 text-stone-400">
                        {referral.rewardFulfilledAt
                          ? `Sent ${formatDate(referral.rewardFulfilledAt)}${
                              referral.rewardReference
                                ? ` · ${referral.rewardReference}`
                                : ""
                            }`
                          : "Not sent yet"}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Referrer
                    </p>
                    <p className="mt-1 text-stone-200">{referral.referrerName}</p>
                    <p className="text-stone-400">{referral.referrerEmail}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Club contact
                    </p>
                    <p className="mt-1 text-stone-200">
                      {referral.contactName} · {referral.contactRole}
                    </p>
                    <p className="text-stone-400">
                      {formatUsPhoneFromDigits(referral.contactPhone)}
                    </p>
                    {referral.howKnow ? (
                      <p className="mt-1 text-stone-500">
                        How they know them: {referral.howKnow}
                      </p>
                    ) : null}
                  </div>
                </div>

                {referral.status === "released" ? (
                  <p className="mt-3 text-sm text-stone-500">
                    Released {formatDate(referral.releasedAt)} — reason:{" "}
                    {referral.releaseReason
                      ? (REFERRAL_RELEASE_REASON_LABELS[
                          referral.releaseReason
                        ] ?? referral.releaseReason)
                      : "—"}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {referral.status === "pending_verify" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(referral, "qualify")}
                      className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
                    >
                      Mark qualified
                    </button>
                  ) : null}
                  {referral.status === "pending_verify" ||
                  referral.status === "qualified" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runAction(referral, "win")}
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Mark won
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRelease(referral)}
                        className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Release
                      </button>
                    </>
                  ) : null}
                  {referral.status === "won" && !referral.rewardFulfilledAt ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleFulfill(referral)}
                      className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Mark gift card sent
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
