type RecaptchaVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const params = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) return false;

  const data = (await response.json()) as RecaptchaVerifyResponse;
  return data.success === true;
}

export function isRecaptchaConfigured() {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}
