import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findMembership: vi.fn(),
  findLocations: vi.fn(),
  upsertLocation: vi.fn(),
  deleteLocations: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/db", () => ({
  db: {
    groupMember: { findUnique: mocks.findMembership },
    liveLocation: {
      findMany: mocks.findLocations,
      upsert: mocks.upsertLocation,
      deleteMany: mocks.deleteLocations,
    },
  },
}));

import { DELETE, GET, PUT } from "@/app/api/live-locations/route";

describe("현재 위치 공유 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", nickname: "지각대장" });
    mocks.findMembership.mockResolvedValue({ id: "member-1" });
  });

  it("그룹 구성원의 위치를 저장하고 만료 시간을 설정한다", async () => {
    mocks.upsertLocation.mockResolvedValue({ updatedAt: new Date(), expiresAt: new Date(Date.now() + 120_000) });
    const response = await PUT(new Request("http://localhost/api/live-locations", {
      method: "PUT",
      body: JSON.stringify({ groupId: "group-1", latitude: 37.5, longitude: 127, accuracyMeters: 8.6 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.upsertLocation).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_groupId: { userId: "user-1", groupId: "group-1" } },
      update: expect.objectContaining({ latitude: 37.5, longitude: 127, accuracyMeters: 9 }),
    }));
  });

  it("같은 그룹의 살아 있는 위치만 이름과 함께 반환한다", async () => {
    mocks.findLocations.mockResolvedValue([{
      userId: "user-1",
      latitude: 37.5,
      longitude: 127,
      accuracyMeters: 9,
      updatedAt: new Date("2026-07-20T01:00:00.000Z"),
      user: { nickname: "지각대장" },
    }]);
    const response = await GET(new Request("http://localhost/api/live-locations?groupId=group-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(data.locations).toEqual([expect.objectContaining({ nickname: "지각대장", isMe: true })]);
    expect(mocks.findLocations).toHaveBeenCalledWith(expect.objectContaining({
      where: { groupId: "group-1", expiresAt: { gt: expect.any(Date) } },
    }));
  });

  it("구성원이 아닌 그룹에는 위치를 저장하지 않는다", async () => {
    mocks.findMembership.mockResolvedValue(null);
    const response = await PUT(new Request("http://localhost/api/live-locations", {
      method: "PUT",
      body: JSON.stringify({ groupId: "other-group", latitude: 37.5, longitude: 127, accuracyMeters: 10 }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.upsertLocation).not.toHaveBeenCalled();
  });

  it("공유 중지 시 본인의 해당 그룹 위치만 삭제한다", async () => {
    mocks.deleteLocations.mockResolvedValue({ count: 1 });
    const response = await DELETE(new Request("http://localhost/api/live-locations", {
      method: "DELETE",
      body: JSON.stringify({ groupId: "group-1" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.deleteLocations).toHaveBeenCalledWith({ where: { userId: "user-1", groupId: "group-1" } });
  });
});
