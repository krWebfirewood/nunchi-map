import { describe, expect, it } from "vitest";
import { hasTimeOverlap } from "@/lib/conflict/timeOverlap";

describe("hasTimeOverlap", () => {
  it("겹치는 시간 구간을 찾는다", () => expect(hasTimeOverlap({ startMinutes: 600, endMinutes: 750 }, { startMinutes: 720, endMinutes: 840 })).toBe(true));
  it("끝과 시작만 맞닿으면 겹치지 않는다", () => expect(hasTimeOverlap({ startMinutes: 600, endMinutes: 720 }, { startMinutes: 720, endMinutes: 840 })).toBe(false));
  it("잘못된 시간 범위를 거부한다", () => expect(() => hasTimeOverlap({ startMinutes: 720, endMinutes: 600 }, { startMinutes: 720, endMinutes: 840 })).toThrow(RangeError));
});
