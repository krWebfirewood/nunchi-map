import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("비밀번호를 평문이 아닌 scrypt 해시로 저장하고 검증한다", async () => {
    const hash = await hashPassword("safe-password-123");
    expect(hash).not.toContain("safe-password-123");
    await expect(verifyPassword("safe-password-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
