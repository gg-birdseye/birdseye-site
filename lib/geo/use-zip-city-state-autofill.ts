"use client";

import { useCallback, useEffect, useRef } from "react";
import { extractUsZip5 } from "@/lib/geo/lookup-zip";

export async function fetchCityStateFromZip(
  zip5: string,
): Promise<{ city: string; state: string } | null> {
  const response = await fetch(`/api/geo/zip?zip=${encodeURIComponent(zip5)}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { city?: string; state?: string };
  if (!data.city?.trim() || !data.state?.trim()) return null;

  return {
    city: data.city.trim(),
    state: data.state.trim(),
  };
}

export function useZipCityStateAutofill(
  zip: string,
  onMatch: (city: string, state: string) => void,
) {
  const onMatchRef = useRef(onMatch);
  const zipRef = useRef(zip);

  onMatchRef.current = onMatch;
  zipRef.current = zip;

  const runLookup = useCallback((zipValue: string) => {
    const zip5 = extractUsZip5(zipValue);
    if (!zip5) return;

    void fetchCityStateFromZip(zip5).then((result) => {
      if (!result || extractUsZip5(zipRef.current) !== zip5) return;
      onMatchRef.current(result.city, result.state);
    });
  }, []);

  useEffect(() => {
    const zip5 = extractUsZip5(zip);
    if (!zip5) return;

    const timer = window.setTimeout(() => {
      runLookup(zip);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [zip, runLookup]);

  const handleZipBlur = useCallback(() => {
    runLookup(zip);
  }, [runLookup, zip]);

  return { handleZipBlur };
}
