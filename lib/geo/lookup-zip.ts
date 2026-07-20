export type ZipLookupResult = {
  city: string;
  state: string;
  zip: string;
};

export function extractUsZip5(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 5) return null;
  return digits.slice(0, 5);
}

export async function lookupUsZipCityState(zip5: string): Promise<ZipLookupResult | null> {
  if (!/^\d{5}$/.test(zip5)) return null;

  const response = await fetch(`https://api.zippopotam.us/us/${zip5}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`ZIP lookup failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    "post code"?: string;
    places?: Array<{
      "place name"?: string;
      "state abbreviation"?: string;
    }>;
  };

  const place = data.places?.[0];
  const city = place?.["place name"]?.trim();
  const state = place?.["state abbreviation"]?.trim();
  if (!city || !state) return null;

  return {
    zip: data["post code"]?.trim() || zip5,
    city,
    state,
  };
}
