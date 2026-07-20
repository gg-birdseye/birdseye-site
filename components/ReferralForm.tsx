"use client";

import { useCallback, useState } from "react";
import { RecaptchaWidget } from "@/components/RecaptchaWidget";
import { formatUsPhoneInput } from "@/lib/format-phone";
import { US_STATES } from "@/lib/geo/us-states";
import {
  CONTACT_ROLE_OPTIONS,
  GIFT_CARD_OPTIONS,
  REFERRAL_REWARDS,
} from "@/lib/referrals/domain";

type FormState = "idle" | "submitting" | "success" | "error";

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25";

const selectClassName =
  "w-full rounded-lg border border-white/10 bg-[var(--surface)] px-4 py-3 text-white outline-none transition focus:border-white/25 [color-scheme:dark] [&>option]:bg-[var(--surface)] [&>option]:text-white";

const labelClassName = "mb-1.5 block text-sm font-medium text-stone-300";

export function ReferralForm() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [holeCount, setHoleCount] = useState<number>(18);
  const [giftCardChoice, setGiftCardChoice] = useState(
    GIFT_CARD_OPTIONS[0].value,
  );
  const [contactPhone, setContactPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaKey((key) => key + 1);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState("submitting");
    setErrorMessage("");
    setErrorCode("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (siteKey && !captchaToken) {
      setFormState("error");
      setErrorMessage("Please complete the captcha.");
      return;
    }

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: data.get("courseName"),
          courseCity: data.get("courseCity"),
          courseState: data.get("courseState"),
          holeCount,
          referrerName: data.get("referrerName"),
          referrerEmail: data.get("referrerEmail"),
          contactName: data.get("contactName"),
          contactRole: data.get("contactRole"),
          contactPhone,
          howKnow: data.get("howKnow"),
          giftCardChoice: data.get("giftCardChoice"),
          website: data.get("website"),
          captchaToken,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setErrorCode(result.code ?? "");
        throw new Error(result.error ?? "Something went wrong.");
      }

      form.reset();
      setContactPhone("");
      setCaptchaToken("");
      setFormState("success");
    } catch (error) {
      setFormState("error");
      resetCaptcha();
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  }

  if (formState === "success") {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Referral received
        </h2>
        <p className="mt-3 text-stone-300">
          Thanks! Your referral is in and the course is held for you while we
          verify your club contact. We&apos;ve emailed you a confirmation and
          will keep you posted.
        </p>
        <button
          type="button"
          onClick={() => setFormState("idle")}
          className="mt-8 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
        >
          Refer another course
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="hidden" aria-hidden>
        <label htmlFor="refer-website">Website</label>
        <input
          id="refer-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className="text-lg font-semibold text-white">The course</legend>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="refer-course-name" className={labelClassName}>
              Course name
            </label>
            <input
              id="refer-course-name"
              name="courseName"
              type="text"
              required
              disabled={formState === "submitting"}
              className={inputClassName}
              placeholder="e.g. Willow Creek Golf Club"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="refer-course-city" className={labelClassName}>
                City
              </label>
              <input
                id="refer-course-city"
                name="courseCity"
                type="text"
                required
                disabled={formState === "submitting"}
                className={inputClassName}
                placeholder="City"
              />
            </div>
            <div>
              <label htmlFor="refer-course-state" className={labelClassName}>
                State
              </label>
              <select
                id="refer-course-state"
                name="courseState"
                required
                defaultValue=""
                disabled={formState === "submitting"}
                className={selectClassName}
              >
                <option value="" hidden>
                  Select a state
                </option>
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className={labelClassName}>Course size</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {[9, 18, 27].map((holes) => (
                <label
                  key={holes}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition ${
                    holeCount === holes
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="holeCount"
                      value={holes}
                      checked={holeCount === holes}
                      onChange={() => setHoleCount(holes)}
                      disabled={formState === "submitting"}
                      className="accent-white"
                    />
                    <span className="font-medium text-white">{holes} holes</span>
                  </span>
                  <span className="text-sm text-stone-400">
                    ${REFERRAL_REWARDS[holes]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-white">
          Club contact we can reach
        </legend>
        <p className="mt-1 text-sm text-stone-500">
          A referral needs a real, reachable decision-maker at the club — a head
          pro, GM, or owner. We verify every contact before a referral counts.
        </p>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="refer-contact-name" className={labelClassName}>
                Contact full name
              </label>
              <input
                id="refer-contact-name"
                name="contactName"
                type="text"
                required
                disabled={formState === "submitting"}
                className={inputClassName}
                placeholder="First and last name"
              />
            </div>
            <div>
              <label htmlFor="refer-contact-role" className={labelClassName}>
                Their role at the club
              </label>
              <select
                id="refer-contact-role"
                name="contactRole"
                required
                defaultValue=""
                disabled={formState === "submitting"}
                className={selectClassName}
              >
                <option value="" hidden>
                  Select a role
                </option>
                {CONTACT_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="refer-contact-phone" className={labelClassName}>
              Contact phone number
            </label>
            <input
              id="refer-contact-phone"
              name="contactPhone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="off"
              value={contactPhone}
              onChange={(event) =>
                setContactPhone(formatUsPhoneInput(event.target.value))
              }
              disabled={formState === "submitting"}
              className={inputClassName}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label htmlFor="refer-how-know" className={labelClassName}>
              How do you know them?{" "}
              <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <textarea
              id="refer-how-know"
              name="howKnow"
              rows={2}
              disabled={formState === "submitting"}
              className={`${inputClassName} resize-y`}
              placeholder="e.g. I'm a member there and talk with the pro shop often"
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-white">About you</legend>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="refer-name" className={labelClassName}>
                Your name
              </label>
              <input
                id="refer-name"
                name="referrerName"
                type="text"
                required
                autoComplete="name"
                disabled={formState === "submitting"}
                className={inputClassName}
                placeholder="Name"
              />
            </div>
            <div>
              <label htmlFor="refer-email" className={labelClassName}>
                Your email
              </label>
              <input
                id="refer-email"
                name="referrerEmail"
                type="email"
                required
                autoComplete="email"
                disabled={formState === "submitting"}
                className={inputClassName}
                placeholder="Email"
              />
            </div>
          </div>
          <div>
            <span className={labelClassName}>
              Gift card preference (for successful referral)
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {GIFT_CARD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-3 transition ${
                    giftCardChoice === option.value
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="giftCardChoice"
                    value={option.value}
                    required
                    checked={giftCardChoice === option.value}
                    onChange={() => setGiftCardChoice(option.value)}
                    disabled={formState === "submitting"}
                    className="accent-white"
                  />
                  <span className="font-medium text-white">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <RecaptchaWidget
        key={captchaKey}
        onToken={setCaptchaToken}
        onExpire={resetCaptcha}
        onError={resetCaptcha}
      />

      {formState === "error" && errorMessage ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            errorCode === "already_claimed" || errorCode === "already_customer"
              ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
              : "border-red-400/30 bg-red-500/10 text-red-300"
          }`}
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={
          formState === "submitting" ||
          Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captchaToken)
        }
        className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {formState === "submitting" ? "Submitting…" : "Submit referral"}
      </button>
    </form>
  );
}
