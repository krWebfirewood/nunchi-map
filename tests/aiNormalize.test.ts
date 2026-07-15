import { describe, expect, it } from "vitest";
import { createParsedScheduleDraft, normalizeParsedSchedule } from "@/lib/ai/normalize";
import type { ParsedSchedule } from "@/lib/ai/schemas";

const modelOutput: ParsedSchedule = {
  date: "2026-07-15",
  startTime: "14:00",
  endTime: "20:00",
  locationName: "당산",
  radiusMeters: 1500,
  preferences: { maxTravelMinutes: null, needsCinema: true, needsCafe: null },
  assumptions: ["영등포는 가장 가까운 의미의 장소로 선택되었습니다."],
};

describe("normalizeParsedSchedule", () => {
  it("명시적인 상대 날짜, 시간, 장소를 코드로 보정한다", () => {
    const result = normalizeParsedSchedule("이번 주 일요일 오후 2시부터 6시까지 영등포에서 영화 보고 싶어", "2026-07-15", modelOutput);
    expect(result.date).toBe("2026-07-19");
    expect(result.startTime).toBe("14:00");
    expect(result.endTime).toBe("18:00");
    expect(result.locationName).toBe("영등포");
    expect(result.assumptions).toEqual([]);
  });

  it("다음 주 요일을 정확히 계산한다", () => {
    const result = normalizeParsedSchedule("다음 주 월요일 오전 9시부터 11시까지 당산", "2026-07-15", modelOutput);
    expect(result.date).toBe("2026-07-20");
    expect(result.startTime).toBe("09:00");
    expect(result.endTime).toBe("11:00");
  });
});

describe("createParsedScheduleDraft", () => {
  it("명시된 날짜, 시간, 장소로 즉시 초안을 만든다", () => {
    const result = createParsedScheduleDraft("이번 주 일요일 오후 2시부터 6시까지 영등포에서 영화", "2026-07-15");
    expect(result).toMatchObject({ date: "2026-07-19", startTime: "14:00", endTime: "18:00", locationName: "영등포" });
  });

  it("필수 정보가 부족하면 초안을 만들지 않는다", () => {
    expect(createParsedScheduleDraft("이번 주 일요일에 놀고 싶어", "2026-07-15")).toBeNull();
  });
});
