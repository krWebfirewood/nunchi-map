import { describe, expect, it } from "vitest";
import { uniquePeerUserIds } from "@/lib/schedules/conflicts";

describe("uniquePeerUserIds", () => {
  it("현재 사용자를 익명 충돌 비교 대상에서 제외한다", () => {
    expect(uniquePeerUserIds("me", ["me", "peer-a", "peer-b", "peer-a"])).toEqual(["peer-a", "peer-b"]);
  });

  it("그룹에 본인만 있으면 비교 대상을 비운다", () => {
    expect(uniquePeerUserIds("me", ["me"])).toEqual([]);
  });
});
