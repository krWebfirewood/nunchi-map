import { calculateDistanceMeters } from "./distance";
import { hasTimeOverlap } from "./timeOverlap";
import type { ConflictResult, ConflictSchedule, DateLike } from "./types";

function toDateKey(value: DateLike): string {
  if (typeof value === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("날짜는 YYYY-MM-DD 형식이어야 합니다.");
    return value;
  }
  if (Number.isNaN(value.getTime())) throw new RangeError("유효한 날짜가 필요합니다.");
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function calculateConflict(a: ConflictSchedule, b: ConflictSchedule): ConflictResult {
  if (a.radiusMeters < 0 || b.radiusMeters < 0) throw new RangeError("반경은 0 이상이어야 합니다.");
  const sameDate = toDateKey(a.date) === toDateKey(b.date);
  const timeOverlap = hasTimeOverlap(a, b);
  const distanceMeters = calculateDistanceMeters(a, b);
  const spatialOverlap = distanceMeters <= a.radiusMeters + b.radiusMeters;
  return { isConflict: sameDate && timeOverlap && spatialOverlap, sameDate, timeOverlap, spatialOverlap, distanceMeters };
}
