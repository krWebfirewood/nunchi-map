import { describe, expect, it } from "vitest";
import { calculateDistanceMeters } from "@/lib/conflict/distance";

describe("calculateDistanceMeters", () => {
  it("같은 좌표의 거리는 0이다", () => expect(calculateDistanceMeters({ latitude: 37.5159, longitude: 126.9075 }, { latitude: 37.5159, longitude: 126.9075 })).toBe(0));
  it("영등포와 신도림의 직선 거리를 계산한다", () => {
    const distance = calculateDistanceMeters({ latitude: 37.5159, longitude: 126.9075 }, { latitude: 37.5088, longitude: 126.8913 });
    expect(distance).toBeGreaterThan(1500);
    expect(distance).toBeLessThan(1800);
  });
  it("잘못된 좌표를 거부한다", () => expect(() => calculateDistanceMeters({ latitude: 100, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow(RangeError));
});
