import type { Coordinates } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

function assertCoordinates(point: Coordinates): void {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new RangeError("유효한 위도와 경도가 필요합니다.");
}

export function calculateDistanceMeters(a: Coordinates, b: Coordinates): number {
  assertCoordinates(a);
  assertCoordinates(b);
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}
