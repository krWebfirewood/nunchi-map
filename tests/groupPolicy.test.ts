import { describe, expect, it } from "vitest";
import { canDeleteGroup, canLeaveGroup, groupRoleForUser, resolveGroupOwnerId } from "@/lib/groups/policy";

describe("그룹 역할 정책", () => {
  it("저장된 생성자를 우선 사용한다", () => {
    expect(resolveGroupOwnerId("owner", ["first-member", "owner"])).toBe("owner");
  });

  it("기존 그룹은 최초 구성원을 생성자로 해석한다", () => {
    expect(resolveGroupOwnerId(null, ["first-member", "second-member"])).toBe("first-member");
  });

  it("생성자는 삭제만, 일반 구성원은 탈퇴만 가능하다", () => {
    const ownerRole = groupRoleForUser("owner", "owner");
    const memberRole = groupRoleForUser("member", "owner");
    expect(canDeleteGroup(ownerRole)).toBe(true);
    expect(canLeaveGroup(ownerRole)).toBe(false);
    expect(canDeleteGroup(memberRole)).toBe(false);
    expect(canLeaveGroup(memberRole)).toBe(true);
  });
});
