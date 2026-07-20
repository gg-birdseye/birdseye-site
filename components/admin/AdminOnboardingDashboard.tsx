"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientWithCourses } from "@/lib/db/schema";
import { resolveAccountLabel, resolvePriceLabel } from "@/lib/onboarding/client-utils";
import { formatScheduleAText } from "@/lib/onboarding/contract-schedule";
import {
  CONTRACT_VARIANT_FILENAMES,
  CONTRACT_VARIANT_LABELS,
  resolveContractVariant,
} from "@/lib/onboarding/contract-variants";
import { calculateMultiCourseQuote, isStandardHoleTier } from "@/lib/pricing/multi-course";
import {
  TRAVEL_DISTANCE_THRESHOLD_MILES,
  formatTravelMobilizationFeeLabel,
} from "@/lib/pricing/travel";
import {
  PaymentSummaryPanel,
} from "@/components/PaymentSummaryPanel";
import { computeInvitePaymentSummary } from "@/lib/pricing/invite-payment-summary";
import { useZipCityStateAutofill } from "@/lib/geo/use-zip-city-state-autofill";

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white";

type CourseFormRow = {
  courseName: string;
  holeCount: string;
  customHoleCount: string;
  customPriceDollars: string;
  courseAddressLine1: string;
  courseCity: string;
  courseState: string;
  courseZip: string;
};

function emptyCourseRow(): CourseFormRow {
  return {
    courseName: "",
    holeCount: "18",
    customHoleCount: "",
    customPriceDollars: "",
    courseAddressLine1: "",
    courseCity: "",
    courseState: "",
    courseZip: "",
  };
}

function parseCourseFormRow(row: CourseFormRow) {
  const isOther = row.holeCount === "other";
  const customHoleCount = isOther ? Number(row.customHoleCount.trim()) : null;
  const holeCount = isOther ? customHoleCount : Number(row.holeCount);

  let customUnitPriceCents: number | null = null;
  if (isOther && row.customPriceDollars.trim()) {
    const parsed = Number(row.customPriceDollars.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      customUnitPriceCents = Math.round(parsed * 100);
    }
  }

  return {
    courseName: row.courseName.trim(),
    holeCount: holeCount ?? NaN,
    customHoleCount: isOther ? customHoleCount : null,
    customUnitPriceCents,
    isOther,
  };
}

function courseRowToLineInput(row: CourseFormRow) {
  const parsed = parseCourseFormRow(row);
  if (!parsed.courseName) return null;

  return {
    courseName: parsed.courseName,
    holeCount: parsed.holeCount,
    customHoleCount: parsed.customHoleCount,
    customUnitPriceCents: parsed.customUnitPriceCents,
    courseAddressLine1: row.courseAddressLine1.trim() || null,
    courseCity: row.courseCity.trim() || null,
    courseState: row.courseState.trim() || null,
    courseZip: row.courseZip.trim() || null,
  };
}

export function AdminOnboardingDashboard() {
  const [clients, setClients] = useState<ClientWithCourses[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const [form, setForm] = useState({
    organizationName: "",
    contactName: "",
    contactEmail: "",
    billingApEmail: "",
    courses: [emptyCourseRow()],
    plan: "annual" as "annual" | "monthly",
    paymentMethod: "stripe" as "stripe" | "manual",
    customPriceDollars: "",
    adminNotes: "",
    sendEmail: true,
    travelMobilizationFeeRequired: false,
    tradeOutElected: false,
    tradeOutCreditAmount: "",
    tradeOutCompRoundsPerYear: "",
    tradeOutMaxPlayersPerRound: "4",
    tradeOutBookingRestrictions: "",
    tradeOutBookingContact: "",
    productionWindow: "",
    teeTime1: "",
    teeTime2: "",
    teeTime3: "",
    onSiteCourseRepresentative: "",
    specialAccessInstructions: "",
    projectSpecificNotes: "",
  });
  const [travelDistanceMessage, setTravelDistanceMessage] = useState("");
  const [travelBeyondThreshold, setTravelBeyondThreshold] = useState(false);
  const [travelDistanceLoading, setTravelDistanceLoading] = useState(false);

  const quotePreview = useMemo(() => {
    const courseLines = form.courses
      .map(courseRowToLineInput)
      .filter((line): line is NonNullable<typeof line> => line != null);
    if (courseLines.length === 0) return null;
    return calculateMultiCourseQuote(courseLines, form.plan);
  }, [form.courses, form.plan]);

  const contractVariantPreview = useMemo(
    () =>
      resolveContractVariant({
        travelMobilizationFeeRequired: form.travelMobilizationFeeRequired,
        tradeOutElected: form.tradeOutElected,
        contractVariant: null,
      }),
    [form.travelMobilizationFeeRequired, form.tradeOutElected],
  );

  const paymentSummary = useMemo(() => {
    const courseLines = form.courses
      .map(courseRowToLineInput)
      .filter((line): line is NonNullable<typeof line> => line != null);
    if (courseLines.length === 0) return null;

    const customPriceRaw = form.customPriceDollars.trim();
    let customPriceCents: number | null = null;
    if (customPriceRaw) {
      const parsed = Number(customPriceRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      customPriceCents = Math.round(parsed * 100);
    }

    if (!quotePreview && customPriceCents == null) return null;

    const subscriptionCents = customPriceCents ?? quotePreview!.totalCents;

    return computeInvitePaymentSummary({
      plan: form.plan,
      subscriptionCents,
      quotedSubtotalCents: quotePreview?.subtotalCents,
      multiCourseDiscountCents: quotePreview?.discountCents,
      multiCourseDiscountPercent: quotePreview?.discountPercent,
      isCustomPrice: customPriceCents != null,
      travelRequired: form.travelMobilizationFeeRequired,
      tradeOutElected: form.tradeOutElected,
      tradeOutCreditAmountRaw: form.tradeOutCreditAmount,
      courseLines: quotePreview?.courses.map((line) => ({
        courseName: line.courseName,
        resolvedHoleCount: line.resolvedHoleCount,
        unitPriceCents: line.unitPriceCents,
      })),
    });
  }, [
    form.courses,
    form.plan,
    form.customPriceDollars,
    form.travelMobilizationFeeRequired,
    form.tradeOutElected,
    form.tradeOutCreditAmount,
    quotePreview,
  ]);

  const schedulePreview = useMemo(() => {
    const courseLines = form.courses
      .map((row) => {
        const parsed = parseCourseFormRow(row);
        if (!parsed.courseName) return null;
        return {
          id: parsed.courseName,
          courseName: parsed.courseName,
          holeCount: parsed.holeCount,
          customHoleCount: parsed.customHoleCount,
          customUnitPriceCents: parsed.customUnitPriceCents,
          courseAddressLine1: row.courseAddressLine1.trim() || null,
          courseCity: row.courseCity.trim() || null,
          courseState: row.courseState.trim() || null,
          courseZip: row.courseZip.trim() || null,
          courseSlug: null,
          sanityCourseId: null,
          clientId: "preview",
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);

    if (courseLines.length === 0 || !quotePreview) return null;

    const customPriceCents = form.customPriceDollars.trim()
      ? Math.round(Number(form.customPriceDollars) * 100)
      : null;

    return formatScheduleAText(
      {
        id: "preview",
        token: "preview",
        organizationName: form.organizationName.trim() || null,
        courseName:
          form.organizationName.trim() ||
          (courseLines.length === 1 ? courseLines[0].courseName : "Multi-course account"),
        contactName: form.contactName || null,
        contactTitle: null,
        contactEmail: form.contactEmail || null,
        billingApEmail: form.billingApEmail.trim() || null,
        contactPhone: null,
        billingAddressLine1: null,
        billingAddressLine2: null,
        billingCity: null,
        billingState: null,
        billingZip: null,
        referralSource: null,
        adminNotes: null,
        productionWindow: form.productionWindow.trim() || null,
        teeTime1: form.teeTime1.trim() || null,
        teeTime2: form.teeTime2.trim() || null,
        teeTime3: form.teeTime3.trim() || null,
        onSiteCourseRepresentative: form.onSiteCourseRepresentative.trim() || null,
        specialAccessInstructions: form.specialAccessInstructions.trim() || null,
        projectSpecificNotes: form.projectSpecificNotes.trim() || null,
        quotedSubtotalCents: quotePreview.subtotalCents,
        multiCourseDiscountCents: quotePreview.discountCents,
        multiCourseDiscountPercent: quotePreview.discountPercent,
        travelMobilizationFeeRequired: form.travelMobilizationFeeRequired,
        travelMobilizationFeeOverride: null,
        travelDistanceMiles: null,
        contractVariant: contractVariantPreview,
        tradeOutElected: form.tradeOutElected,
        tradeOutCreditAmount: form.tradeOutCreditAmount.trim() || null,
        tradeOutCompRoundsPerYear: form.tradeOutCompRoundsPerYear
          ? Number(form.tradeOutCompRoundsPerYear)
          : null,
        tradeOutMaxPlayersPerRound: form.tradeOutMaxPlayersPerRound
          ? Number(form.tradeOutMaxPlayersPerRound)
          : null,
        tradeOutBookingRestrictions: form.tradeOutBookingRestrictions.trim() || null,
        tradeOutBookingContact: form.tradeOutBookingContact.trim() || null,
        holeCount: courseLines[0].holeCount,
        customHoleCount: null,
        plan: form.plan,
        customPriceCents,
        paymentMethod: form.paymentMethod,
        onboardingStatus: "invited",
        billingStatus: "inactive",
        paymentStatus: "pending",
        contentAccessOverride: false,
        contractSignedAt: null,
        contractSignerName: null,
        docusignEnvelopeId: null,
        docusignContractStatus: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeCheckoutSessionId: null,
        manualPaymentReceivedAt: null,
        manualPaymentAmountCents: null,
        manualPaymentMethod: null,
        manualPaymentReference: null,
        manualPaymentNotes: null,
        courseSlug: null,
        sanityCourseId: null,
        invitedAt: new Date(),
        intakeCompletedAt: null,
        paidAt: null,
        suspendedAt: null,
        gracePeriodEndsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      courseLines,
      form.plan,
    );
  }, [form, quotePreview, contractVariantPreview]);

  const courseAddressSignature = useMemo(
    () =>
      form.courses
        .map(
          (row) =>
            `${row.courseAddressLine1}|${row.courseCity}|${row.courseState}|${row.courseZip}`,
        )
        .join(";"),
    [form.courses],
  );

  useEffect(() => {
    const hasAddress = form.courses.some(
      (row) => (row.courseCity.trim() && row.courseState.trim()) || row.courseZip.trim(),
    );

    if (!hasAddress) {
      setTravelDistanceMessage("");
      setTravelBeyondThreshold(false);
      setTravelDistanceLoading(false);
      return;
    }

    const controller = new AbortController();
    setTravelDistanceLoading(true);
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/admin/travel-distance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courses: form.courses.map((row) => ({
                courseName: row.courseName,
                courseAddressLine1: row.courseAddressLine1,
                courseCity: row.courseCity,
                courseState: row.courseState,
                courseZip: row.courseZip,
              })),
            }),
            signal: controller.signal,
          });
          const result = await parseJsonResponse<{
            evaluation?: { beyondThreshold: boolean; message: string };
            error?: string;
          }>(response);
          if (!response.ok) throw new Error(result.error ?? "Unable to estimate distance.");
          if (result.evaluation) {
            setTravelDistanceMessage(result.evaluation.message);
            setTravelBeyondThreshold(result.evaluation.beyondThreshold);
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setTravelDistanceMessage(
            err instanceof Error ? err.message : "Unable to estimate distance.",
          );
          setTravelBeyondThreshold(false);
        } finally {
          if (!controller.signal.aborted) setTravelDistanceLoading(false);
        }
      })();
    }, 900);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [courseAddressSignature, form.courses]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/clients", {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      const result = await parseJsonResponse<{
        clients?: ClientWithCourses[];
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to load clients.");
      setClients(result.clients ?? []);
    } catch (err) {
      const message =
        err instanceof Error && err.name === "TimeoutError"
          ? "Loading clients timed out. Try again."
          : err instanceof Error
            ? err.message
            : "Unable to load clients.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  function updateCourse(index: number, patch: Partial<CourseFormRow>) {
    setForm((current) => ({
      ...current,
      courses: current.courses.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addCourseRow() {
    setForm((current) => ({
      ...current,
      courses: [...current.courses, emptyCourseRow()],
    }));
  }

  function removeCourseRow(index: number) {
    setForm((current) => ({
      ...current,
      courses:
        current.courses.length === 1
          ? current.courses
          : current.courses.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setInviteUrl("");

    try {
      const courses = form.courses
        .map(courseRowToLineInput)
        .filter((row): row is NonNullable<typeof row> => row != null);

      if (courses.length === 0) {
        throw new Error("Add at least one course.");
      }

      for (const row of form.courses) {
        if (!row.courseName.trim()) continue;
        const parsed = parseCourseFormRow(row);
        if (!parsed.isOther) continue;
        if (
          !Number.isFinite(parsed.customHoleCount) ||
          (parsed.customHoleCount ?? 0) <= 0
        ) {
          throw new Error(
            `Enter a valid hole count for ${parsed.courseName || "custom course"}.`,
          );
        }
        if (
          isStandardHoleTier(parsed.customHoleCount!) &&
          !parsed.customUnitPriceCents
        ) {
          throw new Error(
            `${parsed.courseName}: ${parsed.customHoleCount} holes matches a standard tier — choose 9, 18, or 27 instead of Other.`,
          );
        }
        if (!parsed.customUnitPriceCents) {
          throw new Error(
            `Enter a custom price for ${parsed.courseName || "custom course"}.`,
          );
        }
      }

      const customPriceDollars = form.customPriceDollars.trim();
      let customPriceCents: number | null = null;
      if (customPriceDollars) {
        const parsed = Number(customPriceDollars);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("Custom price must be a positive number.");
        }
        customPriceCents = Math.round(parsed * 100);
      }

      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim() || undefined,
          courseName:
            form.organizationName.trim() ||
            (courses.length === 1 ? courses[0].courseName : "Multi-course account"),
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          billingApEmail: form.billingApEmail.trim() || undefined,
          courses,
          plan: form.plan,
          paymentMethod: form.paymentMethod,
          customPriceCents,
          adminNotes: form.adminNotes,
          sendEmail: form.sendEmail,
          travelMobilizationFeeRequired: form.travelMobilizationFeeRequired,
          tradeOutElected: form.tradeOutElected,
          tradeOutCreditAmount: form.tradeOutCreditAmount,
          tradeOutCompRoundsPerYear: form.tradeOutCompRoundsPerYear,
          tradeOutMaxPlayersPerRound: form.tradeOutMaxPlayersPerRound,
          tradeOutBookingRestrictions: form.tradeOutBookingRestrictions,
          tradeOutBookingContact: form.tradeOutBookingContact,
          productionWindow: form.productionWindow.trim() || undefined,
          teeTime1: form.teeTime1.trim() || undefined,
          teeTime2: form.teeTime2.trim() || undefined,
          teeTime3: form.teeTime3.trim() || undefined,
          onSiteCourseRepresentative: form.onSiteCourseRepresentative.trim() || undefined,
          specialAccessInstructions: form.specialAccessInstructions.trim() || undefined,
          projectSpecificNotes: form.projectSpecificNotes.trim() || undefined,
        }),
      });
      const result = await parseJsonResponse<{
        inviteUrl?: string;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to create invite.");
      setInviteUrl(result.inviteUrl ?? "");
      setForm((current) => ({
        ...current,
        organizationName: "",
        contactName: "",
        contactEmail: "",
        billingApEmail: "",
        courses: [emptyCourseRow()],
        adminNotes: "",
        customPriceDollars: "",
        travelMobilizationFeeRequired: false,
        tradeOutElected: false,
        tradeOutCreditAmount: "",
        tradeOutCompRoundsPerYear: "",
        tradeOutMaxPlayersPerRound: "4",
        tradeOutBookingRestrictions: "",
        tradeOutBookingContact: "",
        productionWindow: "",
        teeTime1: "",
        teeTime2: "",
        teeTime3: "",
        onSiteCourseRepresentative: "",
        specialAccessInstructions: "",
        projectSpecificNotes: "",
      }));
      setTravelBeyondThreshold(false);
      setTravelDistanceMessage("");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create invite.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runClientAction(
    id: string,
    action: "mark-paid" | "suspend" | "reactivate" | "create-sanity-course",
  ) {
    setError("");
    try {
      const response = await fetch(`/api/admin/clients/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "mark-paid" ? JSON.stringify({ method: "check" }) : undefined,
      });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Action failed.");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function deleteClient(client: ClientWithCourses) {
    const label = resolveAccountLabel(client);
    const confirmed = window.confirm(
      `Delete "${label}"?\n\nThis permanently removes the client record, invite link, and onboarding data. Stripe subscriptions and DocuSign envelopes are not cancelled automatically.`,
    );
    if (!confirmed) return;

    setError("");
    setDeletingClientId(client.id);
    try {
      const response = await fetch(`/api/admin/clients/${client.id}`, {
        method: "DELETE",
      });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to delete client.");
      setClients((current) => current.filter((row) => row.id !== client.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete client.");
    } finally {
      setDeletingClientId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Client onboarding</h1>
          <p className="mt-2 text-stone-400">
            Create one subscription per account — add multiple courses with automatic
            volume discounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-stone-200"
        >
          Sign out
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white">Create invite</h2>
        <form className="mt-6 space-y-6" onSubmit={createInvite}>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              placeholder="Organization / operator name (optional)"
              value={form.organizationName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  organizationName: event.target.value,
                }))
              }
              className={inputClassName}
            />
            <input
              required
              type="email"
              placeholder="Contact email"
              value={form.contactEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, contactEmail: event.target.value }))
              }
              className={inputClassName}
            />
            <input
              type="email"
              placeholder="Billing / AP email (optional)"
              value={form.billingApEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, billingApEmail: event.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Contact name"
              value={form.contactName}
              onChange={(event) =>
                setForm((current) => ({ ...current, contactName: event.target.value }))
              }
              className={inputClassName}
            />
            <select
              value={form.plan}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  plan: event.target.value as "annual" | "monthly",
                }))
              }
              className={inputClassName}
            >
              <option value="annual">Annual</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value as "stripe" | "manual",
                }))
              }
              className={inputClassName}
            >
              <option value="stripe">Card (Stripe)</option>
              <option value="manual">Manual (cash / check)</option>
            </select>
            <input
              placeholder="Custom total price (USD, optional override)"
              value={form.customPriceDollars}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customPriceDollars: event.target.value,
                }))
              }
              className={inputClassName}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-stone-400">
                Courses on this subscription
              </h3>
              <button
                type="button"
                onClick={addCourseRow}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-stone-200"
              >
                Add course
              </button>
            </div>
            {form.courses.map((row, index) => (
              <div
                key={index}
                className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <input
                    required={index === 0}
                    placeholder={`Course ${index + 1} name`}
                    value={row.courseName}
                    onChange={(event) =>
                      updateCourse(index, { courseName: event.target.value })
                    }
                    className={inputClassName}
                  />
                  <select
                    value={row.holeCount}
                    onChange={(event) =>
                      updateCourse(index, {
                        holeCount: event.target.value,
                        customHoleCount:
                          event.target.value === "other" ? row.customHoleCount : "",
                        customPriceDollars:
                          event.target.value === "other" ? row.customPriceDollars : "",
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="9">9 holes</option>
                    <option value="18">18 holes</option>
                    <option value="27">27 holes</option>
                    <option value="other">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCourseRow(index)}
                    disabled={form.courses.length === 1}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs text-stone-300 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
                {row.holeCount === "other" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      required
                      inputMode="numeric"
                      placeholder="Hole count (e.g. 13)"
                      value={row.customHoleCount}
                      onChange={(event) =>
                        updateCourse(index, { customHoleCount: event.target.value })
                      }
                      className={inputClassName}
                    />
                    <input
                      required
                      inputMode="decimal"
                      placeholder={
                        form.plan === "monthly"
                          ? "Custom price (USD/mo)"
                          : "Custom price (USD/yr)"
                      }
                      value={row.customPriceDollars}
                      onChange={(event) =>
                        updateCourse(index, { customPriceDollars: event.target.value })
                      }
                      className={inputClassName}
                    />
                  </div>
                ) : null}
                <input
                  placeholder="Course address (street)"
                  value={row.courseAddressLine1}
                  onChange={(event) =>
                    updateCourse(index, { courseAddressLine1: event.target.value })
                  }
                  className={inputClassName}
                />
                <AdminCourseCityStateZip
                  city={row.courseCity}
                  state={row.courseState}
                  zip={row.courseZip}
                  onChange={(patch) => updateCourse(index, patch)}
                />
              </div>
            ))}
            <p className="text-xs text-stone-500">
              Add as many courses as needed — all are listed on Schedule A and sent to DocuSign
              automatically. Choose <strong>Other</strong> for non-standard hole counts (e.g. a
              13-hole short course) and enter an agreed custom price.
            </p>
          </div>

          {schedulePreview ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-300">
              <p className="font-medium text-white">Schedule A preview (DocuSign)</p>
              <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-stone-400">
                {schedulePreview}
              </pre>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={form.travelMobilizationFeeRequired}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  travelMobilizationFeeRequired: event.target.checked,
                }))
              }
              className="mt-1"
            />
            <span>
              Add a one-time {formatTravelMobilizationFeeLabel()} Travel & Mobilization Fee
              to the initial payment.
            </span>
          </label>
          {travelDistanceLoading ? (
            <p className="text-xs text-stone-500">Estimating distance from Richmond, UT…</p>
          ) : travelDistanceMessage ? (
            <p
              className={`text-xs ${
                travelBeyondThreshold ? "text-amber-200/90" : "text-stone-400"
              }`}
            >
              {travelDistanceMessage}
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              Enter a course city/state or ZIP to check distance from Richmond, UT (200-mile
              threshold).
            </p>
          )}

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-medium text-white">Production schedule (Schedule A)</h3>
            <p className="mt-1 text-xs text-stone-400">
              Set when you schedule filming. Pre-fills the agreement; leave blank to show
              &quot;TBD&quot; on the contract.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                placeholder="Production window (e.g. June 15–16, 2026, 6:00–10:00 AM)"
                value={form.productionWindow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productionWindow: event.target.value,
                  }))
                }
                className={`${inputClassName} md:col-span-2`}
              />
              <input
                placeholder="Reserved tee time 1 (e.g. 7:10 AM)"
                value={form.teeTime1}
                onChange={(event) =>
                  setForm((current) => ({ ...current, teeTime1: event.target.value }))
                }
                className={inputClassName}
              />
              <input
                placeholder="Reserved tee time 2 (e.g. 7:20 AM)"
                value={form.teeTime2}
                onChange={(event) =>
                  setForm((current) => ({ ...current, teeTime2: event.target.value }))
                }
                className={inputClassName}
              />
              <input
                placeholder="Reserved tee time 3 (e.g. 7:30 AM)"
                value={form.teeTime3}
                onChange={(event) =>
                  setForm((current) => ({ ...current, teeTime3: event.target.value }))
                }
                className={inputClassName}
              />
              <input
                placeholder="On-site course representative (e.g. John Smith, Head Pro)"
                value={form.onSiteCourseRepresentative}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    onSiteCourseRepresentative: event.target.value,
                  }))
                }
                className={inputClassName}
              />
              <input
                placeholder="Special access instructions (optional)"
                value={form.specialAccessInstructions}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    specialAccessInstructions: event.target.value,
                  }))
                }
                className={`${inputClassName} md:col-span-2`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-medium text-white">Project-specific notes (Schedule A)</h3>
            <p className="mt-1 text-xs text-stone-400">
              Optional notes for Section 4 of the Statement of Work. Leave blank to show
              &quot;N/A&quot; on the contract.
            </p>
            <textarea
              placeholder="e.g. Coordinate drone launch from maintenance area north of hole 10."
              value={form.projectSpecificNotes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  projectSpecificNotes: event.target.value,
                }))
              }
              className={`${inputClassName} mt-4 w-full`}
              rows={4}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-medium text-white">Trade-out credit (Schedule A)</h3>
            <p className="mt-1 text-xs text-stone-400">
              Set after your conversation with the client. Pre-fills the agreement; clients do
              not enter this during onboarding.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                checked={form.tradeOutElected}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tradeOutElected: event.target.checked,
                  }))
                }
              />
              Trade-out credit applied
            </label>
            {form.tradeOutElected ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Annual credit amount in USD (e.g. 1000)"
                  value={form.tradeOutCreditAmount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeOutCreditAmount: event.target.value,
                    }))
                  }
                  className={`${inputClassName} md:col-span-2`}
                />
                <input
                  required
                  type="number"
                  min={1}
                  placeholder="Comp rounds per contract year"
                  value={form.tradeOutCompRoundsPerYear}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeOutCompRoundsPerYear: event.target.value,
                    }))
                  }
                  className={inputClassName}
                />
                <input
                  required
                  type="number"
                  min={1}
                  max={4}
                  placeholder="Max players per round"
                  value={form.tradeOutMaxPlayersPerRound}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeOutMaxPlayersPerRound: event.target.value,
                    }))
                  }
                  className={inputClassName}
                />
                <input
                  placeholder="Booking restrictions (optional)"
                  value={form.tradeOutBookingRestrictions}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeOutBookingRestrictions: event.target.value,
                    }))
                  }
                  className={`${inputClassName} md:col-span-2`}
                />
                <input
                  required
                  placeholder="Booking contact / pro shop phone"
                  value={form.tradeOutBookingContact}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tradeOutBookingContact: event.target.value,
                    }))
                  }
                  className={`${inputClassName} md:col-span-2`}
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-birdseye-400/20 bg-birdseye-950/20 p-4 text-sm text-stone-300">
            <p className="font-medium text-white">Contract template</p>
            <p className="mt-1 text-stone-200">
              {CONTRACT_VARIANT_LABELS[contractVariantPreview]}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              DocuSign will use{" "}
              <span className="text-stone-400">
                {CONTRACT_VARIANT_FILENAMES[contractVariantPreview]}
              </span>
              . Travel fee and trade-out sections are omitted from the agreement when those
              options are not selected.
            </p>
          </div>

          {paymentSummary ? (
            <PaymentSummaryPanel summary={paymentSummary} audience="admin" />
          ) : null}

          <textarea
            placeholder="Admin notes"
            value={form.adminNotes}
            onChange={(event) =>
              setForm((current) => ({ ...current, adminNotes: event.target.value }))
            }
            className={`${inputClassName} w-full`}
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, sendEmail: event.target.checked }))
              }
            />
            Email invite link to client
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-birdseye-500 px-8 py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create invite link"}
          </button>
        </form>
        {inviteUrl ? (
          <p className="mt-4 break-all rounded-lg border border-birdseye-400/30 bg-birdseye-900/30 px-4 py-3 text-sm text-stone-200">
            Invite link: {inviteUrl}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">Clients</h2>
          {!loading ? (
            <button
              type="button"
              onClick={() => void loadClients()}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-stone-200"
            >
              Refresh
            </button>
          ) : null}
        </div>
        {loading ? (
          <p className="mt-4 text-stone-400">Loading clients...</p>
        ) : loadError ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadClients()}
              className="rounded-full bg-birdseye-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : clients.length === 0 ? (
          <p className="mt-4 text-stone-400">No clients yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {clients.map((client) => {
              const inviteLink = `/onboarding/${client.token}`;
              const courseCount = client.courses?.length || 1;
              const sanityLinked = client.courses?.length
                ? client.courses.filter((course) => course.sanityCourseId).length
                : client.sanityCourseId
                  ? 1
                  : 0;
              const needsSanity =
                client.billingStatus === "active" &&
                sanityLinked < courseCount;

              return (
                <article
                  key={client.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {resolveAccountLabel(client)}
                      </h3>
                      <p className="text-sm text-stone-400">
                        {client.contactName ?? "No contact"} · {client.contactEmail ?? "No email"}
                      </p>
                      {client.courses?.length ? (
                        <ul className="mt-2 space-y-1 text-sm text-stone-500">
                          {client.courses.map((course) => (
                            <li key={course.id}>
                              {course.courseName} · {course.customHoleCount ?? course.holeCount} holes
                              {course.courseSlug ? ` · /${course.courseSlug}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-sm text-stone-500">
                        Onboarding: {client.onboardingStatus} · Billing: {client.billingStatus}{" "}
                        · {resolvePriceLabel(client)}
                        {(client.multiCourseDiscountPercent ?? 0) > 0
                          ? ` · ${client.multiCourseDiscountPercent}% multi-course discount`
                          : ""}
                        {client.travelMobilizationFeeRequired
                          ? ` · ${formatTravelMobilizationFeeLabel()} travel fee`
                          : ""}
                        {client.travelDistanceMiles != null
                          ? ` · ${client.travelDistanceMiles} mi from Richmond, UT`
                          : ""}
                        {client.travelDistanceMiles != null &&
                        client.travelDistanceMiles > TRAVEL_DISTANCE_THRESHOLD_MILES &&
                        !client.travelMobilizationFeeRequired
                          ? " · over 200 mi — fee not added"
                          : ""}
                      </p>
                      {needsSanity ? (
                        <p className="mt-1 text-sm text-amber-200/90">
                          Sanity: {sanityLinked}/{courseCount} courses linked
                        </p>
                      ) : sanityLinked > 0 ? (
                        <p className="mt-1 text-sm text-stone-500">
                          Sanity: {sanityLinked}/{courseCount} courses linked
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            `${window.location.origin}${inviteLink}`,
                          )
                        }
                        className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-stone-200"
                      >
                        Copy invite link
                      </button>
                      {client.paymentMethod === "manual" &&
                      client.onboardingStatus !== "active" ? (
                        <button
                          type="button"
                          onClick={() => void runClientAction(client.id, "mark-paid")}
                          className="rounded-full bg-birdseye-500 px-3 py-1.5 text-xs text-white"
                        >
                          Mark payment received
                        </button>
                      ) : null}
                      {needsSanity ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runClientAction(client.id, "create-sanity-course")
                          }
                          className="rounded-full border border-birdseye-400/40 px-3 py-1.5 text-xs text-birdseye-200"
                        >
                          Create Sanity courses
                        </button>
                      ) : null}
                      {client.billingStatus === "active" ? (
                        <button
                          type="button"
                          onClick={() => void runClientAction(client.id, "suspend")}
                          className="rounded-full border border-amber-400/40 px-3 py-1.5 text-xs text-amber-100"
                        >
                          Suspend content
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void runClientAction(client.id, "reactivate")}
                          className="rounded-full border border-birdseye-400/40 px-3 py-1.5 text-xs text-birdseye-200"
                        >
                          Reactivate content
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteClient(client)}
                        disabled={deletingClientId === client.id}
                        className="rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
                      >
                        {deletingClientId === client.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AdminCourseCityStateZip({
  city,
  state,
  zip,
  onChange,
}: {
  city: string;
  state: string;
  zip: string;
  onChange: (patch: {
    courseCity?: string;
    courseState?: string;
    courseZip?: string;
  }) => void;
}) {
  const { handleZipBlur } = useZipCityStateAutofill(zip, (nextCity, nextState) => {
    onChange({ courseCity: nextCity, courseState: nextState });
  });

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <input
        placeholder="ZIP"
        inputMode="numeric"
        autoComplete="postal-code"
        value={zip}
        onChange={(event) => onChange({ courseZip: event.target.value })}
        onBlur={handleZipBlur}
        className={inputClassName}
      />
      <input
        placeholder="City"
        value={city}
        onChange={(event) => onChange({ courseCity: event.target.value })}
        className={inputClassName}
      />
      <input
        placeholder="State"
        value={state}
        onChange={(event) => onChange({ courseState: event.target.value })}
        className={inputClassName}
      />
    </div>
  );
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Empty response from server.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid response from server.");
  }
}
