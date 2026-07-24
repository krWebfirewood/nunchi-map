import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findUsers: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  clearSessionCookie: vi.fn(),
  createSessionCookie: vi.fn(),
  SESSION_COOKIE: "nunchi_session",
  sessionExpiresAt: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: mocks.findUsers,
    },
  },
}));

import { GET as getSession } from "@/app/api/session/route";
import { GET as getUsers } from "@/app/api/users/route";

describe("초기 화면 API 오류 응답", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("세션 DB 연결이 지연되면 JSON 503과 재시도 시간을 반환한다", async () => {
    mocks.getSessionUser.mockRejectedValueOnce({ code: "P2024" });

    const response = await getSession(new Request("http://localhost/api/session"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(data.message).toContain("데이터베이스 연결");
  });

  it("데모 사용자 DB 연결이 지연되어도 빈 500 응답을 반환하지 않는다", async () => {
    mocks.findUsers.mockRejectedValueOnce({ code: "P2024" });

    const response = await getUsers();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toContain("잠시 후 다시 시도");
  });
});
