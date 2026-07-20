import { describe, expect, it } from "vitest";
import { isLiveLocationFresh, LIVE_LOCATION_TTL_MS, liveLocationExpiresAt, liveLocationInputSchema } from "@/lib/locations/live";

describe("현재 위치 공유", () => {
  it("정상적인 GPS 좌표와 정확도를 허용한다", () => {
    const parsed = liveLocationInputSchema.safeParse({
      groupId: "group-1",
      latitude: 37.5665,
      longitude: 126.978,
      accuracyMeters: 12.4,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.accuracyMeters).toBe(12);
  });

  it("범위를 벗어난 좌표를 거부한다", () => {
    expect(liveLocationInputSchema.safeParse({ groupId: "g", latitude: 91, longitude: 127, accuracyMeters: 10 }).success).toBe(false);
    expect(liveLocationInputSchema.safeParse({ groupId: "g", latitude: 37, longitude: 181, accuracyMeters: 10 }).success).toBe(false);
  });

  it("마지막 갱신 후 2분 동안만 위치를 활성 상태로 본다", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    const expiresAt = liveLocationExpiresAt(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(LIVE_LOCATION_TTL_MS);
    expect(isLiveLocationFresh(expiresAt, new Date(now.getTime() + LIVE_LOCATION_TTL_MS - 1))).toBe(true);
    expect(isLiveLocationFresh(expiresAt, new Date(now.getTime() + LIVE_LOCATION_TTL_MS))).toBe(false);
  });
});
