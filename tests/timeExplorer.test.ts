import { describe, expect, it } from "vitest";
import { isScheduleActiveAtTime, isScheduleActiveInRange, summarizeSchedulesAtTime, summarizeSchedulesInRange, type TimedMapSchedule } from "@/lib/map/timeExplorer";

function schedule(overrides: Partial<TimedMapSchedule> = {}): TimedMapSchedule {
  return {
    startMinutes: 600,
    endMinutes: 720,
    latitude: 37.5345,
    longitude: 126.9026,
    radiusMeters: 500,
    source: "own",
    ...overrides,
  };
}

describe("isScheduleActiveAtTime", () => {
  it("시작 시각은 포함하고 종료 시각은 포함하지 않는다", () => {
    const target = schedule();
    expect(isScheduleActiveAtTime(target, 600)).toBe(true);
    expect(isScheduleActiveAtTime(target, 719)).toBe(true);
    expect(isScheduleActiveAtTime(target, 720)).toBe(false);
  });
});

describe("summarizeSchedulesAtTime", () => {
  it("선택 시간에 활성화된 일정만 집계한다", () => {
    const result = summarizeSchedulesAtTime([
      schedule(),
      schedule({ source: "group", startMinutes: 720, endMinutes: 780 }),
    ], 660);
    expect(result).toMatchObject({ activeCount: 1, ownCount: 1, groupCount: 0, riskLevel: "safe" });
  });

  it("활성 내 일정과 그룹 일정의 반경이 겹치면 주의로 표시한다", () => {
    const result = summarizeSchedulesAtTime([schedule(), schedule({ source: "group" })], 660);
    expect(result).toMatchObject({ activeCount: 2, conflictPairCount: 1, riskLevel: "medium" });
  });

  it("겹치는 일정 쌍이 둘 이상이면 높음으로 표시한다", () => {
    const result = summarizeSchedulesAtTime([
      schedule(),
      schedule({ source: "group" }),
      schedule({ source: "group", latitude: 37.5347, longitude: 126.9028 }),
    ], 660);
    expect(result).toMatchObject({ conflictPairCount: 2, riskLevel: "high" });
  });

  it("같은 시간이라도 반경이 멀면 안전으로 표시한다", () => {
    const result = summarizeSchedulesAtTime([
      schedule(),
      schedule({ source: "group", latitude: 35.1796, longitude: 129.0756 }),
    ], 660);
    expect(result).toMatchObject({ activeCount: 2, conflictPairCount: 0, riskLevel: "safe" });
  });
});

describe("선택 시간 범위", () => {
  it("선택 구간과 조금이라도 겹치는 일정을 활성화한다", () => {
    expect(isScheduleActiveInRange(schedule({ startMinutes: 600, endMinutes: 720 }), 660, 780)).toBe(true);
    expect(isScheduleActiveInRange(schedule({ startMinutes: 600, endMinutes: 660 }), 660, 780)).toBe(false);
    expect(isScheduleActiveInRange(schedule({ startMinutes: 780, endMinutes: 840 }), 660, 780)).toBe(false);
  });

  it("선택 구간 안에서 실제 시간과 위치가 함께 겹치는 쌍만 충돌로 집계한다", () => {
    const result = summarizeSchedulesInRange([
      schedule({ startMinutes: 600, endMinutes: 660 }),
      schedule({ source: "group", startMinutes: 720, endMinutes: 780 }),
    ], 600, 780);
    expect(result).toMatchObject({ activeCount: 2, conflictPairCount: 0, riskLevel: "safe" });
  });

  it("선택 구간 안에서 시간과 반경이 겹치면 주의로 표시한다", () => {
    const result = summarizeSchedulesInRange([
      schedule({ startMinutes: 600, endMinutes: 720 }),
      schedule({ source: "group", startMinutes: 660, endMinutes: 780 }),
    ], 630, 750);
    expect(result).toMatchObject({ activeCount: 2, conflictPairCount: 1, riskLevel: "medium" });
  });
});
