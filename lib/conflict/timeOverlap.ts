import type { TimeRange } from "./types";

function assertValidRange(range: TimeRange): void {
  if (!Number.isInteger(range.startMinutes) || !Number.isInteger(range.endMinutes)) throw new TypeError("시간은 자정 기준 정수 분 단위여야 합니다.");
  if (range.startMinutes < 0 || range.endMinutes > 1440 || range.startMinutes >= range.endMinutes) throw new RangeError("시작 시간은 종료 시간보다 빨라야 하며 같은 날짜 안에 있어야 합니다.");
}

export function hasTimeOverlap(a: TimeRange, b: TimeRange): boolean {
  assertValidRange(a);
  assertValidRange(b);
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}
