import { NextResponse } from "next/server";
import { extractUsZip5, lookupUsZipCityState } from "@/lib/geo/lookup-zip";

export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip") ?? "";
  const zip5 = extractUsZip5(zip);

  if (!zip5) {
    return NextResponse.json({ error: "Invalid ZIP code." }, { status: 400 });
  }

  try {
    const result = await lookupUsZipCityState(zip5);
    if (!result) {
      return NextResponse.json({ error: "ZIP code not found." }, { status: 404 });
    }

    return NextResponse.json({
      city: result.city,
      state: result.state,
      zip: result.zip,
    });
  } catch (error) {
    console.error("ZIP lookup failed:", error);
    return NextResponse.json({ error: "Unable to look up ZIP code." }, { status: 502 });
  }
}
