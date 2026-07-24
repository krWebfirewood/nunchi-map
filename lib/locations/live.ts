import { z } from "zod";

export const LIVE_LOCATION_TTL_MS = 2 * 60 * 1000;
export const LIVE_LOCATION_POLL_MS = 5_000;

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

export function resolveVisibleLocationGroupId(currentGroupId: string | null, groupIds: string[]): string | null {
  if (currentGroupId && groupIds.includes(currentGroupId)) return currentGroupId;
  return groupIds.length === 1 ? groupIds[0] : null;
}
