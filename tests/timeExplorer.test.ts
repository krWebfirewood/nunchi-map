import { describe, expect, it } from "vitest";
import { isScheduleActiveAtTime, summarizeSchedulesAtTime, type TimedMapSchedule } from "@/lib/map/timeExplorer";

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
