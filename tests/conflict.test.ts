import { describe, expect, it } from "vitest";
import { calculateConflict } from "@/lib/conflict/calculateConflict";
import type { ConflictSchedule } from "@/lib/conflict/types";

const base: ConflictSchedule = { date: "2026-07-19", startMinutes: 780, endMinutes: 1020, latitude: 37.5159, longitude: 126.9075, radiusMeters: 1500 };

describe("calculateConflict", () => {
  it("날짜, 시간, 공간이 모두 겹치면 충돌한다", () => expect(calculateConflict(base, { ...base, startMinutes: 840, endMinutes: 1080 }).isConflict).toBe(true));
  it("날짜가 다르면 충돌하지 않는다", () => expect(calculateConflict(base, { ...base, date: "2026-07-20" }).isConflict).toBe(false));
  it("시간이 다르면 충돌하지 않는다", () => expect(calculateConflict(base, { ...base, startMinutes: 1020, endMinutes: 1140 }).isConflict).toBe(false));
  it("공간이 멀면 충돌하지 않는다", () => expect(calculateConflict(base, { ...base, latitude: 37.5572, longitude: 126.9254, radiusMeters: 100 }).isConflict).toBe(false));
});
