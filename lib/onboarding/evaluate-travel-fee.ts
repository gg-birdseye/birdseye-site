import { distanceFromRichmondUtMiles } from "@/lib/geo/distance";
import { geocodeAddress, hasMinimumAddress, type GeocodeInput } from "@/lib/geo/geocode";
import {
  TRAVEL_DISTANCE_THRESHOLD_MILES,
  TRAVEL_ORIGIN_LABEL,
} from "@/lib/pricing/travel";

export type CourseLocationInput = GeocodeInput & {
  courseName?: string | null;
};

export type TravelFeeEvaluation = {
  beyondThreshold: boolean;
  distanceMiles: number | null;
  furthestCourseName: string | null;
  geocoded: boolean;
  message: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function evaluateTravelFeeFromCourses(
  courses: CourseLocationInput[],
): Promise<TravelFeeEvaluation> {
  const locatedCourses = courses.filter((course) => hasMinimumAddress(course));

  if (locatedCourses.length === 0) {
    return {
      beyondThreshold: false,
      distanceMiles: null,
      furthestCourseName: null,
      geocoded: false,
      message: `Add a course city/state or ZIP to estimate distance from ${TRAVEL_ORIGIN_LABEL}.`,
    };
  }

  let furthestDistance = 0;
  let furthestCourseName: string | null = null;
  let geocodedCount = 0;

  for (const [index, course] of locatedCourses.entries()) {
    if (index > 0) {
      // Nominatim fair-use: one request per second.
      await sleep(1100);
    }

    const geocoded = await geocodeAddress(course);
    if (!geocoded) continue;

    geocodedCount += 1;
    const distanceMiles = Math.round(
      distanceFromRichmondUtMiles(geocoded.latitude, geocoded.longitude),
    );

    if (distanceMiles > furthestDistance) {
      furthestDistance = distanceMiles;
      furthestCourseName = course.courseName?.trim() || `Course ${index + 1}`;
    }
  }

  if (geocodedCount === 0) {
    return {
      beyondThreshold: false,
      distanceMiles: null,
      furthestCourseName: null,
      geocoded: false,
      message: "Could not locate that address. Check the course location and try again.",
    };
  }

  const beyondThreshold = furthestDistance > TRAVEL_DISTANCE_THRESHOLD_MILES;
  const distanceLabel = `${furthestDistance} miles from ${TRAVEL_ORIGIN_LABEL}`;

  return {
    beyondThreshold,
    distanceMiles: furthestDistance,
    furthestCourseName,
    geocoded: true,
    message: beyondThreshold
      ? `${furthestCourseName} is about ${distanceLabel} — over the ${TRAVEL_DISTANCE_THRESHOLD_MILES}-mile threshold. Consider adding the travel fee.`
      : `${furthestCourseName} is about ${distanceLabel} — within the ${TRAVEL_DISTANCE_THRESHOLD_MILES}-mile travel zone.`,
  };
}
