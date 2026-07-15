import { describe, expect, it } from "vitest";
import { parsedScheduleSchema } from "@/lib/ai/schemas";

const valid = {
  date: "2026-07-19",
  startTime: "14:00",
  endTime: "18:00",
  locationName: "영등포",
  radiusMeters: 1500,
  preferences: { maxTravelMinutes: null, needsCinema: true, needsCafe: null },
  assumptions: [],
};

describe("parsedScheduleSchema", () => {
  it("정상적인 AI 일정 응답을 허용한다", () => expect(parsedScheduleSchema.safeParse(valid).success).toBe(true));
  it("전국의 임의 장소명을 허용한다", () => expect(parsedScheduleSchema.safeParse({ ...valid, locationName: "마포구청역" }).success).toBe(true));
  it("빈 장소명은 거부한다", () => expect(parsedScheduleSchema.safeParse({ ...valid, locationName: " " }).success).toBe(false));
  it("잘못된 시간 순서를 거부한다", () => expect(parsedScheduleSchema.safeParse({ ...valid, endTime: "13:00" }).success).toBe(false));
});
