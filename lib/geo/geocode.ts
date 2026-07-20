export type GeocodeInput = {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
};

function buildGeocodeQuery(input: GeocodeInput) {
  const parts = [
    input.addressLine1?.trim(),
    input.city?.trim(),
    input.state?.trim(),
    input.zip?.trim(),
    "USA",
  ].filter(Boolean);

  return parts.join(", ");
}

export function hasMinimumAddress(input: GeocodeInput) {
  const city = input.city?.trim();
  const state = input.state?.trim();
  const zip = input.zip?.trim();
  return Boolean((city && state) || zip);
}

export async function geocodeAddress(
  input: GeocodeInput,
): Promise<GeocodeResult | null> {
  if (!hasMinimumAddress(input)) return null;

  const query = buildGeocodeQuery(input);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        process.env.GEOCODING_USER_AGENT?.trim() ||
        "Birdseye Golf Onboarding/1.0 (greg@birdseye.golf)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status}).`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const match = results[0];
  if (!match) return null;

  return {
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    displayName: match.display_name,
  };
}
