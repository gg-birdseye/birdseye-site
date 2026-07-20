"use client";

import { RecaptchaWidget } from "@/components/RecaptchaWidget";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type ContactFormModalProps = {
  open: boolean;
  onClose: () => void;
};

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactFormModal({ open, onClose }: ContactFormModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaKey((key) => key + 1);
  }, []);

  const handleClose = useCallback(() => {
    if (formState === "submitting") return;
    onClose();
  }, [formState, onClose]);

  useEffect(() => {
    if (!open) {
      setFormState("idle");
      setErrorMessage("");
      setCaptchaToken("");
      setCaptchaKey((key) => key + 1);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (siteKey && !captchaToken) {
      setFormState("error");
      setErrorMessage("Please complete the captcha.");
      return;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          organization: data.get("organization"),
          email: data.get("email"),
          referralSource: data.get("referralSource"),
          message: data.get("message"),
          website: data.get("website"),
          captchaToken,
        }),
      });

      const result = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        throw new Error(result.error ?? "Something went wrong.");
      }

      form.reset();
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
        onMouseDown={handleClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--surface-elevated)] p-6 shadow-2xl md:p-8"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={formState === "submitting"}
          className="absolute right-4 top-4 rounded-full p-2 text-stone-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          aria-label="Close contact form"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {formState === "success" ? (
          <div className="pr-8 text-center">
            <h2 id={titleId} className="text-2xl font-bold tracking-tight text-white">
              Message sent
            </h2>
            <p className="mt-3 text-stone-300">
              Thanks for reaching out. We&apos;ll get back to you soon.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="text-center text-2xl font-bold tracking-tight text-white">
              Get In Touch
            </h2>
            <p className="mt-2 text-stone-400">
              Learn more about pricing or reach out with general inquiries using the form below.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="hidden" aria-hidden>
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <input
                id="contact-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                disabled={formState === "submitting"}
                aria-label="Name"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25"
                placeholder="Name"
              />

              <input
                id="contact-organization"
                name="organization"
                type="text"
                autoComplete="organization"
                disabled={formState === "submitting"}
                aria-label="Golf course or company"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25"
                placeholder="Golf course or company"
              />

              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={formState === "submitting"}
                aria-label="Email"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25"
                placeholder="Email"
              />

              <input
                id="contact-referral-source"
                name="referralSource"
                type="text"
                disabled={formState === "submitting"}
                aria-label="How did you hear about us?"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25"
                placeholder="How did you hear about us?"
              />

              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                disabled={formState === "submitting"}
                aria-label="Message"
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-stone-500 focus:border-white/25"
                placeholder="Message"
              />

              <RecaptchaWidget
                key={captchaKey}
                onToken={setCaptchaToken}
                onExpire={resetCaptcha}
                onError={resetCaptcha}
              />

              {formState === "error" && errorMessage ? (
                <p className="text-sm text-red-400" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  formState === "submitting" ||
                  Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captchaToken)
                }
                className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-stone-100 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formState === "submitting" ? "Sending..." : "Send message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
