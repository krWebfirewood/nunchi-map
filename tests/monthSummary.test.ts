import type { Schedule } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { monthDatabaseRange, summarizeScheduleMonth } from "@/lib/schedules/monthSummary";

function schedule(overrides: Partial<Schedule> & Pick<Schedule, "id" | "userId">): Schedule {
  return {
    date: new Date("2030-01-15T00:00:00+09:00"),
    startMinutes: 720,
    endMinutes: 840,
    locationName: "당산",
    latitude: 37.5345,
    longitude: 126.9026,
    radiusMeters: 500,
    shareWithGroups: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("summarizeScheduleMonth", () => {
  it("공유 일정이 있고 충돌이 없으면 안전 상태로 집계한다", () => {
    const result = summarizeScheduleMonth("me", [schedule({ id: "own", userId: "me" })], []);
    expect(result["2030-01-15"]).toEqual({ scheduleCount: 1, sharedCount: 1, privateCount: 0, riskStatus: "safe" });
  });

  it("나만 보기 일정만 있으면 비공개 상태로 집계한다", () => {
    const result = summarizeScheduleMonth("me", [schedule({ id: "own", userId: "me", shareWithGroups: false })], []);
    expect(result["2030-01-15"].riskStatus).toBe("private");
  });

  it("나만 보기 일정도 그룹 일정과 충돌하면 위험 표시를 우선한다", () => {
    const own = schedule({ id: "own", userId: "me", shareWithGroups: false });
    const peers = [
      schedule({ id: "peer-1", userId: "peer-1" }),
      schedule({ id: "peer-2", userId: "peer-2", startMinutes: 750 }),
    ];
    expect(summarizeScheduleMonth("me", [own], [peers[0]])["2030-01-15"].riskStatus).toBe("medium");
    expect(summarizeScheduleMonth("me", [own], peers)["2030-01-15"].riskStatus).toBe("high");
  });
});

describe("monthDatabaseRange", () => {
  it("12월 다음 달 범위를 다음 해 1월로 계산한다", () => {
    const range = monthDatabaseRange("2030-12");
    expect(range.start.toISOString()).toBe("2030-11-30T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2030-12-31T15:00:00.000Z");
  });
});
