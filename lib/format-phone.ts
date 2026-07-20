/** Keep up to 10 US national digits; drop a leading country code 1 when present. */
export function normalizeUsPhoneDigits(value: string | null | undefined): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function formatUsPhoneFromDigits(digits: string): string {
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Format partial or full phone input as the user types. */
export function formatUsPhoneInput(value: string): string {
  return formatUsPhoneFromDigits(normalizeUsPhoneDigits(value));
}

export function isCompleteUsPhone(value: string | null | undefined): boolean {
  return normalizeUsPhoneDigits(value).length === 10;
}
