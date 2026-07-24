import { describe, expect, it } from "vitest";
import { isLiveLocationAccurateEnough, isLiveLocationFresh, LIVE_LOCATION_MAX_ACCURACY_METERS, LIVE_LOCATION_MIN_PUBLISH_MS, LIVE_LOCATION_POLL_MS, LIVE_LOCATION_TTL_MS, liveLocationExpiresAt, liveLocationInputSchema, shouldPublishLiveLocation } from "@/lib/locations/live";

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

  it("위치 조회와 저장 호출 간격을 제한한다", () => {
    expect(LIVE_LOCATION_POLL_MS).toBe(15_000);
    expect(LIVE_LOCATION_MIN_PUBLISH_MS).toBe(8_000);
    expect(shouldPublishLiveLocation(null, 1_000)).toBe(true);
    expect(shouldPublishLiveLocation(1_000, 8_999)).toBe(false);
    expect(shouldPublishLiveLocation(1_000, 9_000)).toBe(true);
  });

  it("오차가 큰 모바일 위치는 정확도가 개선될 때까지 공유하지 않는다", () => {
    expect(LIVE_LOCATION_MAX_ACCURACY_METERS).toBe(500);
    expect(isLiveLocationAccurateEnough(108)).toBe(true);
    expect(isLiveLocationAccurateEnough(500)).toBe(true);
    expect(isLiveLocationAccurateEnough(501)).toBe(false);
    expect(isLiveLocationAccurateEnough(2_000)).toBe(false);
  });
});
