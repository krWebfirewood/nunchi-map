import { describe, expect, it } from "vitest";
import { pinMoodForConflictCount, pinMoodForRiskLevel, scheduleConflictCountInRange, type PinSchedule } from "@/lib/map/pinMood";

function schedule(overrides: Partial<PinSchedule> = {}): PinSchedule {
  return {
    id: "schedule-1",
    startMinutes: 600,
    endMinutes: 720,
    latitude: 37.5345,
    longitude: 126.9026,
    radiusMeters: 500,
    ...overrides,
  };
}

describe("눈치 핀 표정", () => {
  it("충돌 개수와 위험도에 따라 표정이 강해진다", () => {
    expect(pinMoodForConflictCount(0)).toBe("happy");
    expect(pinMoodForConflictCount(1)).toBe("worried");
    expect(pinMoodForConflictCount(2)).toBe("frown");
    expect(pinMoodForRiskLevel(null)).toBe("neutral");
    expect(pinMoodForRiskLevel("low")).toBe("happy");
    expect(pinMoodForRiskLevel("high")).toBe("frown");
  });

  it("선택 시간과 반경이 모두 겹치는 일정만 센다", () => {
    const target = schedule();
    const schedules = [
      target,
      schedule({ id: "near", startMinutes: 660, endMinutes: 780 }),
      schedule({ id: "later", startMinutes: 720, endMinutes: 780 }),
      schedule({ id: "far", latitude: 35.1796, longitude: 129.0756 }),
    ];
    expect(scheduleConflictCountInRange(target, schedules, 600, 750)).toBe(1);
    expect(scheduleConflictCountInRange(target, schedules, 720, 780)).toBe(0);
  });
});
