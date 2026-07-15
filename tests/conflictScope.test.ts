import { describe, expect, it } from "vitest";
import { findPeerScheduleConflicts, shouldBlockScheduleCreation, uniquePeerUserIds, type AnonymousConflictResult } from "@/lib/schedules/conflicts";
import type { Schedule } from "@prisma/client";

describe("uniquePeerUserIds", () => {
  it("현재 사용자를 익명 충돌 비교 대상에서 제외한다", () => {
    expect(uniquePeerUserIds("me", ["me", "peer-a", "peer-b", "peer-a"])).toEqual(["peer-a", "peer-b"]);
  });

  it("그룹에 본인만 있으면 비교 대상을 비운다", () => {
    expect(uniquePeerUserIds("me", ["me"])).toEqual([]);
  });
});

const warningConflict: AnonymousConflictResult = {
  hasConflict: true,
  ownScheduleConflict: false,
  anonymousConflictCount: 1,
  overlapWindow: { startMinutes: 700, endMinutes: 800 },
  riskLevel: "medium",
};

describe("일정 저장 정책", () => {
  it("그룹 일정 충돌은 경고만 하고 저장을 허용한다", () => {
    expect(shouldBlockScheduleCreation(warningConflict)).toBe(false);
  });

  it("본인 일정 시간 충돌은 계속 저장을 차단한다", () => {
    expect(shouldBlockScheduleCreation({ ...warningConflict, ownScheduleConflict: true })).toBe(true);
  });

  it("같은 시간과 지역의 그룹 일정을 위험 대상으로 찾는다", () => {
    const peerSchedule = {
      id: "peer-schedule",
      userId: "peer",
      date: new Date("2030-01-15T00:00:00+09:00"),
      startMinutes: 720,
      endMinutes: 840,
      locationName: "당산",
      latitude: 37.5345,
      longitude: 126.9026,
      radiusMeters: 500,
      createdAt: new Date(),
    } satisfies Schedule;
    const conflicts = findPeerScheduleConflicts({
      userId: "me",
      date: "2030-01-15",
      startMinutes: 780,
      endMinutes: 900,
      locationName: "당산역",
      latitude: 37.5347,
      longitude: 126.9028,
      radiusMeters: 500,
    }, [peerSchedule]);
    expect(conflicts).toHaveLength(1);
  });
});
