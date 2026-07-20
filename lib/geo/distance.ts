/** BirdsEye production base — Richmond, UT */
export const TRAVEL_ORIGIN = {
  label: "Richmond, UT",
  latitude: 41.9224,
  longitude: -111.8136,
} as const;

const EARTH_RADIUS_MILES = 3958.8;

export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceFromRichmondUtMiles(latitude: number, longitude: number) {
  return haversineDistanceMiles(
    TRAVEL_ORIGIN.latitude,
    TRAVEL_ORIGIN.longitude,
    latitude,
    longitude,
  );
}
