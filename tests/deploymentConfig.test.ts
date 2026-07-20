import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POST as parseSchedule } from "@/app/api/ai/parse-schedule/route";

describe("deployment configuration", () => {
  it("uses Postgres for the deployable Prisma schema", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toContain('provider = "postgresql"');
  });

  it("keeps the Ollama parser API disabled unless the feature flag is enabled", async () => {
    const previous = process.env.AI_FEATURE_ENABLED;
    delete process.env.AI_FEATURE_ENABLED;
    try {
      const response = await parseSchedule(new Request("http://localhost/api/ai/parse-schedule", {
        method: "POST",
        body: JSON.stringify({ text: "내일 오후 2시 당산", today: "2026-07-20", timezone: "Asia/Seoul" }),
      }));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("비활성화") });
    } finally {
      if (previous === undefined) delete process.env.AI_FEATURE_ENABLED;
      else process.env.AI_FEATURE_ENABLED = previous;
    }
  });
});
