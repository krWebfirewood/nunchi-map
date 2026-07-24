import { z } from "zod";

export const LIVE_LOCATION_TTL_MS = 2 * 60 * 1000;
export const LIVE_LOCATION_POLL_MS = 15_000;
export const LIVE_LOCATION_MIN_PUBLISH_MS = 8_000;
export const LIVE_LOCATION_MAX_ACCURACY_METERS = 500;

export const liveLocationInputSchema = z.object({
  groupId: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().nonnegative().max(10_000).transform(Math.round),
});

export const liveLocationStopSchema = z.object({ groupId: z.string().min(1) });

export function liveLocationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + LIVE_LOCATION_TTL_MS);
}

export function isLiveLocationFresh(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function shouldPublishLiveLocation(lastPublishedAt: number | null, now = Date.now()): boolean {
  return lastPublishedAt === null || now - lastPublishedAt >= LIVE_LOCATION_MIN_PUBLISH_MS;
}

export function isLiveLocationAccurateEnough(accuracyMeters: number): boolean {
  return Number.isFinite(accuracyMeters) && accuracyMeters <= LIVE_LOCATION_MAX_ACCURACY_METERS;
}
