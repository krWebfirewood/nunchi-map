import { describe, expect, it } from "vitest";
import { scheduleInputSchema } from "@/lib/schedules/schema";

const validInput = {
  userId: "demo-kim",
  date: "2026-07-19",
  startMinutes: 840,
  endMinutes: 1080,
  locationName: "영등포",
  latitude: 37.5159,
  longitude: 126.9075,
  radiusMeters: 1500,
};

describe("scheduleInputSchema", () => {
  it("정상 일정 입력을 허용한다", () => expect(scheduleInputSchema.safeParse(validInput).success).toBe(true));
  it("종료 시간이 시작 시간보다 빠르면 거부한다", () => expect(scheduleInputSchema.safeParse({ ...validInput, endMinutes: 700 }).success).toBe(false));
  it("허용 범위를 벗어난 반경을 거부한다", () => expect(scheduleInputSchema.safeParse({ ...validInput, radiusMeters: 50 }).success).toBe(false));
});
