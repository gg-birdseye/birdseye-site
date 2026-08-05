"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientWithCourses } from "@/lib/db/schema";
import {
  buildPaymentSummaryFromClient,
  getManualPaymentInstructions,
  getOnboardingStep,
  resolveAccountLabel,
  resolveCourseCount,
  resolveHoleCount,
  resolvePlan,
  resolvePriceLabel,
} from "@/lib/onboarding/client-utils";
import { formatScheduleAText } from "@/lib/onboarding/contract-schedule";
import { formatUsPhoneInput } from "@/lib/format-phone";
import { useZipCityStateAutofill } from "@/lib/geo/use-zip-city-state-autofill";
import { US_STATE_CODES, US_STATES } from "@/lib/geo/us-states";
import { PaymentSummaryPanel } from "@/components/PaymentSummaryPanel";

type OnboardingFlowProps = {
  client: ClientWithCourses;
  checkoutStatus?: string | null;
  docusignStatus?: string | null;
};

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25";

export function OnboardingFlow({
  client,
  checkoutStatus,
  docusignStatus,
}: OnboardingFlowProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentClient, setCurrentClient] = useState(client);
  const [docusignEnabled, setDocusignEnabled] = useState(false);
  const [syncingDocuSign, setSyncingDocuSign] = useState(docusignStatus === "complete");
  const [courseLocations, setCourseLocations] = useState(() =>
    buildCourseLocations(client),
  );
  const [contactPhone, setContactPhone] = useState(() =>
    formatUsPhoneInput(client.contactPhone ?? ""),
  );
  const [billingCity, setBillingCity] = useState(() => client.billingCity ?? "");
  const [billingState, setBillingState] = useState(() => client.billingState ?? "");
  const [billingZip, setBillingZip] = useState(() => client.billingZip ?? "");
  const [billingAddressLine1, setBillingAddressLine1] = useState(
    () => client.billingAddressLine1 ?? "",
  );
  const [billingAddressLine2, setBillingAddressLine2] = useState(
    () => client.billingAddressLine2 ?? "",
  );
  const [billingSameAsCourse, setBillingSameAsCourse] = useState(false);

  const step = getOnboardingStep(currentClient);
  const awaitingActivation = checkoutStatus === "success" && step < 4;

  const priceLabel = useMemo(
    () => resolvePriceLabel(currentClient),
    [currentClient],
  );

  const paymentSummary = useMemo(
    () => buildPaymentSummaryFromClient(currentClient),
    [currentClient],
  );

  const scheduleAText = useMemo(
    () =>
      formatScheduleAText(
        currentClient,
        currentClient.courses ?? [],
        resolvePlan(currentClient),
        { includeTravelFee: false },
      ),
    [currentClient],
  );

  const courseCount = resolveCourseCount(currentClient);
  const isMultiCourse = courseCount > 1;
  const accountLabel = resolveAccountLabel(currentClient);

  useEffect(() => {
    void fetch(`/api/onboarding/${currentClient.token}/contract`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { docusignEnabled?: boolean }) => {
        setDocusignEnabled(Boolean(result.docusignEnabled));
      })
      .catch(() => setDocusignEnabled(false));
  }, [currentClient.token]);

  useEffect(() => {
    if (docusignStatus !== "complete") return;

    let cancelled = false;
    setSyncingDocuSign(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/onboarding/${currentClient.token}/contract/sync`,
          { method: "POST" },
        );
        const result = await parseJsonResponse<{ client?: ClientWithCourses }>(response);
        if (!cancelled && result.client) {
          setCurrentClient(result.client);
        }
      } finally {
        if (!cancelled) {
          setSyncingDocuSign(false);
          router.replace(`/onboarding/${currentClient.token}`, { scroll: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docusignStatus, currentClient.token, router]);

  useEffect(() => {
    setCourseLocations(buildCourseLocations(currentClient));
    setBillingCity(currentClient.billingCity ?? "");
    setBillingState(currentClient.billingState ?? "");
    setBillingZip(currentClient.billingZip ?? "");
    setBillingAddressLine1(currentClient.billingAddressLine1 ?? "");
    setBillingAddressLine2(currentClient.billingAddressLine2 ?? "");
    setBillingSameAsCourse(false);
  }, [currentClient.id]);

  useEffect(() => {
    if (!billingSameAsCourse) return;
    const source = courseLocations[0];
    if (!source) return;
    setBillingAddressLine1(source.courseAddressLine1);
    setBillingAddressLine2("");
    setBillingCity(source.courseCity);
    setBillingState(source.courseState);
    setBillingZip(source.courseZip);
  }, [billingSameAsCourse, courseLocations]);

  useEffect(() => {
    if (checkoutStatus !== "success" || step >= 4) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 90;

    async function pollStatus() {
      try {
        const response = await fetch(
          `/api/onboarding/${currentClient.token}/status`,
          { cache: "no-store" },
        );
        const result = await parseJsonResponse<{ client?: ClientWithCourses }>(response);
        if (!cancelled && result.client) {
          setCurrentClient(result.client);
        }
      } catch {
        // Keep showing the payment-received state while webhooks finish.
      }
    }

    void pollStatus();
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.clearInterval(intervalId);
        return;
      }
      void pollStatus();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [checkoutStatus, currentClient.token, step]);

  useEffect(() => {
    if (step === 4 && checkoutStatus === "success") {
      router.replace(`/onboarding/${currentClient.token}`, { scroll: false });
    }
  }, [step, checkoutStatus, router, currentClient.token]);

  async function submitIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/onboarding/${currentClient.token}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: form.get("courseName"),
          contactName: form.get("contactName"),
          contactTitle: form.get("contactTitle"),
          contactEmail: form.get("contactEmail"),
          contactPhone: contactPhone.trim() || null,
          billingAddressLine1,
          billingAddressLine2,
          billingCity,
          billingState,
          billingZip,
          referralSource: form.get("referralSource"),
          courseAddressLine1: courseLocations[0]?.courseAddressLine1,
          courseCity: courseLocations[0]?.courseCity,
          courseState: courseLocations[0]?.courseState,
          courseZip: courseLocations[0]?.courseZip,
          courses: courseLocations,
        }),
      });
      const result = await parseJsonResponse<{ client?: ClientWithCourses; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(result.error ?? "Unable to save intake.");
      if (result.client) setCurrentClient(result.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitContract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/onboarding/${currentClient.token}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: form.get("signerName"),
          agreed: form.get("agreed") === "on",
        }),
      });
      const result = await parseJsonResponse<{ client?: ClientWithCourses; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(result.error ?? "Unable to sign agreement.");
      if (result.client) setCurrentClient(result.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startDocuSign() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/onboarding/${currentClient.token}/contract/docusign`,
        { method: "POST" },
      );
      const result = await parseJsonResponse<{ url?: string; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to start DocuSign.");
      if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function startCheckout() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/onboarding/${currentClient.token}/checkout`, {
        method: "POST",
      });
      const result = await parseJsonResponse<{ url?: string; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to start checkout.");
      if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 space-y-8">
      <ol className="flex flex-wrap gap-3 text-sm font-semibold uppercase tracking-[0.15em] text-stone-500">
        {["Intake", "Agreement", "Payment", "Complete"].map((label, index) => {
          const stepNumber = index + 1;
          const isActive = awaitingActivation
            ? stepNumber === 4
            : step === stepNumber;
          const isDone = step > stepNumber || (awaitingActivation && stepNumber <= 3);
          return (
            <li
              key={label}
              className={`rounded-full px-4 py-2 ${
                isActive
                  ? "bg-birdseye-500 text-white"
                  : isDone
                    ? "bg-white/10 text-stone-200"
                    : "bg-white/5 text-stone-500"
              }`}
            >
              {label}
            </li>
          );
        })}
      </ol>

      {syncingDocuSign ? (
        <section className="rounded-2xl border border-birdseye-400/40 bg-birdseye-900/40 p-8">
          <h2 className="text-2xl font-bold text-white">Finalizing your signature</h2>
          <p className="mt-3 text-stone-300">
            Thanks — we&apos;re confirming your DocuSign agreement now.
          </p>
        </section>
      ) : null}

      {checkoutStatus === "cancel" ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Checkout was cancelled. You can try again when ready.
        </p>
      ) : null}

      {awaitingActivation ? (
        <section className="rounded-2xl border border-birdseye-400/40 bg-birdseye-900/40 p-8">
          <h2 className="text-2xl font-bold text-white">Payment received</h2>
          <p className="mt-3 text-stone-300">
            Thank you — your payment was submitted successfully. We&apos;re activating your
            Birdseye account now.
          </p>
          <p className="mt-2 text-sm text-stone-400">
            This usually takes a few seconds. You&apos;ll see a confirmation here as soon as
            activation finishes, and we&apos;ll email you next steps.
          </p>
          <p className="mt-6 text-sm font-medium text-birdseye-200">
            No further action is needed on your part.
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-bold text-white">
            {isMultiCourse ? "Account details" : "Course details"}
          </h2>
          <p className="mt-2 text-stone-400">
            Confirm your information to get started with Birdseye.
          </p>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submitIntake}>
            {isMultiCourse ? (
              <div className="md:col-span-2">
                <CourseListSummary client={currentClient} />
              </div>
            ) : (
              <Field label="Course name" className="md:col-span-2">
                <input
                  name="courseName"
                  required
                  defaultValue={currentClient.courseName ?? ""}
                  className={inputClassName}
                />
              </Field>
            )}
            <Field label="Contact name">
              <input
                name="contactName"
                required
                defaultValue={currentClient.contactName ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="Title">
              <input
                name="contactTitle"
                required
                placeholder="e.g. General Manager, Owner"
                defaultValue={currentClient.contactTitle ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="Email">
              <input
                name="contactEmail"
                type="email"
                required
                defaultValue={currentClient.contactEmail ?? ""}
                className={inputClassName}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(555) 555-5555"
                required
                minLength={14}
                value={contactPhone}
                onChange={(event) =>
                  setContactPhone(formatUsPhoneInput(event.target.value))
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Referral source">
              <input
                name="referralSource"
                defaultValue={currentClient.referralSource ?? ""}
                className={inputClassName}
              />
            </Field>
            <div className="md:col-span-2">
              <CourseLocationSection
                client={currentClient}
                courseLocations={courseLocations}
                isMultiCourse={isMultiCourse}
                onChange={setCourseLocations}
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-300">Billing address</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-300">
                  <input
                    type="checkbox"
                    checked={billingSameAsCourse}
                    onChange={(event) => setBillingSameAsCourse(event.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-birdseye-500 focus:ring-birdseye-400/40"
                  />
                  <span>
                    {isMultiCourse
                      ? "Same as first course location"
                      : "Same as course location"}
                  </span>
                </label>
              </div>
              <Field label="Street address">
                <input
                  name="billingAddressLine1"
                  required
                  value={billingAddressLine1}
                  onChange={(event) => {
                    setBillingSameAsCourse(false);
                    setBillingAddressLine1(event.target.value);
                  }}
                  className={inputClassName}
                />
              </Field>
              <Field label="Address line 2">
                <input
                  name="billingAddressLine2"
                  value={billingAddressLine2}
                  onChange={(event) => {
                    setBillingSameAsCourse(false);
                    setBillingAddressLine2(event.target.value);
                  }}
                  className={inputClassName}
                />
              </Field>
            </div>
            <BillingCityStateFields
              city={billingCity}
              state={billingState}
              zip={billingZip}
              onCityChange={(value) => {
                setBillingSameAsCourse(false);
                setBillingCity(value);
              }}
              onStateChange={(value) => {
                setBillingSameAsCourse(false);
                setBillingState(value);
              }}
              onZipChange={(value) => {
                setBillingSameAsCourse(false);
                setBillingZip(value);
              }}
            />
            <div className="md:col-span-2">
              {paymentSummary ? (
                <PaymentSummaryPanel summary={paymentSummary} audience="client" />
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-400">
                  Pricing: {priceLabel}{" "}
                  {resolvePlan(currentClient) === "monthly" ? "per month" : "per year"}.
                  Contact Birdseye if this looks incorrect.
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 transition hover:border-white/35 hover:bg-white/10 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Continue to agreement"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 2 && !syncingDocuSign ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-bold text-white">Service agreement</h2>
          <p className="mt-2 text-stone-400">
            Review Schedule A below{courseCount > 1 ? ` — all ${courseCount} courses are listed` : ""}.
            {docusignEnabled
              ? " You will sign the full agreement in DocuSign with this course list included automatically."
              : " Accept the agreement to continue."}
          </p>
          <div className="mt-6 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-stone-300">
            <p>
              This agreement covers Birdseye hosting, maintenance, and content services for{" "}
              <strong>{accountLabel}</strong>.
            </p>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-stone-300">
              {scheduleAText}
            </pre>
          </div>
          <div className="mt-6">
            {paymentSummary ? (
              <PaymentSummaryPanel summary={paymentSummary} audience="client" />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-400">
                Pricing: {priceLabel}{" "}
                {resolvePlan(currentClient) === "monthly" ? "per month" : "per year"}.
                Contact Birdseye if this looks incorrect.
              </div>
            )}
          </div>
          {docusignEnabled ? (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={startDocuSign}
                disabled={submitting}
                className="inline-flex rounded-full border border-white/20 bg-birdseye-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-birdseye-400 disabled:opacity-60"
              >
                {submitting ? "Opening DocuSign..." : "Sign in DocuSign"}
              </button>
              <p className="text-xs text-stone-500">
                Schedule A in DocuSign will include all {courseCount}{" "}
                {courseCount === 1 ? "course" : "courses"} configured for this account.
              </p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submitContract}>
              <label className="flex items-start gap-3 text-sm text-stone-300">
                <input name="agreed" type="checkbox" required className="mt-1" />
                <span>I agree to the Birdseye service agreement.</span>
              </label>
              <Field label="Full legal name">
                <input name="signerName" required className={inputClassName} />
              </Field>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 transition hover:border-white/35 hover:bg-white/10 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Sign and continue"}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {step === 3 && !awaitingActivation ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-bold text-white">Payment</h2>
          {currentClient.paymentMethod === "manual" ? (
            <>
              <p className="mt-2 text-stone-400">
                Your payment has been arranged offline. Once we receive it, we&apos;ll activate
                your account and email you confirmation.
              </p>
              <div className="mt-6 whitespace-pre-line rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-stone-300">
                {getManualPaymentInstructions()}
              </div>
              {paymentSummary ? (
                <div className="mt-6">
                  <PaymentSummaryPanel summary={paymentSummary} audience="client" />
                </div>
              ) : null}
              <p className="mt-4 text-sm text-stone-500">
                Status: Awaiting payment confirmation
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-stone-400">
                Review your charges below, then continue to secure checkout.
              </p>
              {paymentSummary ? (
                <div className="mt-6">
                  <PaymentSummaryPanel summary={paymentSummary} audience="client" />
                </div>
              ) : (
                <p className="mt-2 text-stone-400">
                  Complete secure checkout for {priceLabel}{" "}
                  {resolvePlan(currentClient) === "monthly" ? "per month" : "per year"}.
                </p>
              )}
              <button
                type="button"
                onClick={startCheckout}
                disabled={submitting}
                className="mt-6 inline-flex rounded-full border border-white/20 bg-birdseye-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-birdseye-400 disabled:opacity-60"
              >
                {submitting ? "Redirecting..." : "Continue to secure checkout"}
              </button>
            </>
          )}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="rounded-2xl border border-birdseye-400/40 bg-birdseye-900/40 p-8">
          <h2 className="text-2xl font-bold text-white">You&apos;re all set</h2>
          <p className="mt-2 text-stone-300">
            Your Birdseye account for {accountLabel} is active
            {isMultiCourse ? ` — all ${courseCount} courses` : ""}.
          </p>
          <p className="mt-4 text-sm text-stone-400">
            We&apos;ll follow up with additional details when everything is up and running.
            Typical lead time is about two weeks after initial payment. If you have any
            questions in the meantime, feel free to reply to your confirmation email.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function buildCourseLocations(client: ClientWithCourses) {
  const courses = client.courses ?? [];
  if (courses.length === 0) {
    return [
      {
        courseAddressLine1: "",
        courseCity: "",
        courseState: "",
        courseZip: "",
      },
    ];
  }

  return courses.map((course) => ({
    courseAddressLine1: course.courseAddressLine1 ?? "",
    courseCity: course.courseCity ?? "",
    courseState: course.courseState ?? "",
    courseZip: course.courseZip ?? "",
  }));
}

function CourseLocationSection({
  client,
  courseLocations,
  isMultiCourse,
  onChange,
}: {
  client: ClientWithCourses;
  courseLocations: Array<{
    courseAddressLine1: string;
    courseCity: string;
    courseState: string;
    courseZip: string;
  }>;
  isMultiCourse: boolean;
  onChange: React.Dispatch<
    React.SetStateAction<
      Array<{
        courseAddressLine1: string;
        courseCity: string;
        courseState: string;
        courseZip: string;
      }>
    >
  >;
}) {
  const courses = client.courses ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="font-medium text-stone-200">Course location</p>
      <p className="mt-1 text-sm text-stone-500">
        Used for production scheduling and your service agreement.
      </p>
      <div className="mt-4 space-y-4">
        {courseLocations.map((location, index) => (
          <CourseLocationRow
            key={index}
            label={
              isMultiCourse
                ? (courses[index]?.courseName ?? `Course ${index + 1}`)
                : null
            }
            location={location}
            onChange={(patch) =>
              onChange((current) =>
                current.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, ...patch } : row,
                ),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

type CourseLocation = {
  courseAddressLine1: string;
  courseCity: string;
  courseState: string;
  courseZip: string;
};

function CourseLocationRow({
  label,
  location,
  onChange,
}: {
  label: string | null;
  location: CourseLocation;
  onChange: (patch: Partial<CourseLocation>) => void;
}) {
  const { handleZipBlur } = useZipCityStateAutofill(location.courseZip, (city, state) => {
    onChange({ courseCity: city, courseState: state });
  });

  return (
    <div className="space-y-3">
      {label ? <p className="text-sm font-medium text-stone-300">{label}</p> : null}
      <input
        placeholder="Street address"
        required
        value={location.courseAddressLine1}
        onChange={(event) => onChange({ courseAddressLine1: event.target.value })}
        className={inputClassName}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          placeholder="ZIP"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          value={location.courseZip}
          onChange={(event) => onChange({ courseZip: event.target.value })}
          onBlur={handleZipBlur}
          className={inputClassName}
        />
        <input
          placeholder="City"
          required
          value={location.courseCity}
          onChange={(event) => onChange({ courseCity: event.target.value })}
          className={inputClassName}
        />
        <StateSelect
          required
          value={location.courseState}
          onChange={(value) => onChange({ courseState: value })}
        />
      </div>
    </div>
  );
}

function CourseListSummary({
  client,
  compact = false,
}: {
  client: ClientWithCourses;
  compact?: boolean;
}) {
  const courses = client.courses ?? [];
  if (courses.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/20 text-sm text-stone-300 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {!compact ? (
        <p className="font-medium text-stone-200">
          {resolveAccountLabel(client)} · {courses.length} courses
        </p>
      ) : (
        <p className="text-xs uppercase tracking-[0.15em] text-stone-500">Courses</p>
      )}
      <ul className={`space-y-1 ${compact ? "mt-2" : "mt-3"}`}>
        {courses.map((course) => (
          <li key={course.id} className="flex justify-between gap-4">
            <span>{course.courseName}</span>
            <span className="text-stone-500">
              {resolveHoleCount(client, course)} holes
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BillingCityStateFields({
  city,
  state,
  zip,
  onCityChange,
  onStateChange,
  onZipChange,
}: {
  city: string;
  state: string;
  zip: string;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onZipChange: (value: string) => void;
}) {
  const { handleZipBlur } = useZipCityStateAutofill(zip, (nextCity, nextState) => {
    onCityChange(nextCity);
    onStateChange(nextState);
  });

  return (
    <>
      <Field label="ZIP">
        <input
          name="billingZip"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="12345"
          value={zip}
          onChange={(event) => onZipChange(event.target.value)}
          onBlur={handleZipBlur}
          className={inputClassName}
        />
      </Field>
      <Field label="City">
        <input
          name="billingCity"
          required
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          className={inputClassName}
        />
      </Field>
      <Field label="State">
        <StateSelect
          name="billingState"
          required
          value={state}
          onChange={onStateChange}
        />
      </Field>
    </>
  );
}

function StateSelect({
  value,
  onChange,
  name,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedValue = value.trim().toUpperCase();
  const hasKnownCode = US_STATE_CODES.has(normalizedValue);
  const selectValue = hasKnownCode ? normalizedValue : value.trim();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <select
        name={name}
        required={required}
        value={selectValue}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      >
        <option value="" disabled={required} />
        {value.trim() && !hasKnownCode ? (
          <option value={value.trim()}>{value.trim()}</option>
        ) : null}
        {US_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.code}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${inputClassName} flex items-center justify-between text-left ${
          selectValue ? "text-white" : "text-stone-500"
        }`}
      >
        <span>{selectValue || "State"}</span>
        <span className="ml-2 text-[10px] text-stone-500" aria-hidden>
          ▼
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-black py-1 shadow-lg"
        >
          {US_STATES.map((state) => (
            <li key={state.code} role="option" aria-selected={selectValue === state.code}>
              <button
                type="button"
                onClick={() => {
                  onChange(state.code);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-white/10 ${
                  selectValue === state.code ? "bg-white/5 text-white" : "text-stone-300"
                }`}
              >
                {state.code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium text-stone-300">{label}</span>
      {children}
    </label>
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
