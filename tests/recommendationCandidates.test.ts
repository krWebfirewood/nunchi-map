import { describe, expect, it } from "vitest";
import { generateSafeCandidates } from "@/lib/recommendations/candidates";
import type { ScheduleInput } from "@/lib/schedules/schema";

const input: ScheduleInput = {
  userId: "demo-lee",
  date: "2026-07-19",
  startMinutes: 840,
  endMinutes: 1080,
  locationName: "영등포",
  latitude: 37.5159,
  longitude: 126.9075,
  radiusMeters: 1500,
};

describe("generateSafeCandidates", () => {
  it("returns only candidates that change place or time", () => {
    const candidates = generateSafeCandidates(input, [{
      startMinutes: 780,
      endMinutes: 1020,
      latitude: 37.5159,
      longitude: 126.9075,
      radiusMeters: 1500,
    }]);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.estimatedRisk === "low")).toBe(true);
    expect(candidates.every((candidate) => candidate.locationName !== input.locationName || candidate.startMinutes !== input.startMinutes)).toBe(true);
    expect(candidates.some((candidate) => candidate.type === "time" && candidate.startMinutes >= input.endMinutes)).toBe(true);
  });

  it("does not return a candidate that conflicts with another schedule", () => {
    const candidates = generateSafeCandidates(input, [{
      startMinutes: 0,
      endMinutes: 1440,
      latitude: 37.5159,
      longitude: 126.9075,
      radiusMeters: 10000,
    }]);

    expect(candidates).toEqual([]);
  });
});
