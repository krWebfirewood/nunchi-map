import { createAiClient } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { generateSafeCandidates } from "@/lib/recommendations/candidates";
import { findAnonymousConflicts } from "@/lib/schedules/conflicts";
import { dateToDatabaseValue, scheduleInputSchema } from "@/lib/schedules/schema";

export async function POST(request: Request) {
  const parsed = scheduleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "추천할 일정 조건을 확인해 주세요." }, { status: 400 });

  const conflict = await findAnonymousConflicts(parsed.data);
  if (!conflict.hasConflict) return Response.json({ message: "현재 조건에는 충돌이 없어 대안이 필요하지 않습니다." }, { status: 409 });

  const schedules = await db.schedule.findMany({ where: { date: dateToDatabaseValue(parsed.data.date) } });
  const candidates = generateSafeCandidates(parsed.data, schedules);
  if (candidates.length === 0) return Response.json({
    summary: "현재 날짜 안에서 자동으로 찾은 안전 대안이 없습니다.",
    candidates: [],
    explainedByAi: false,
  });

  try {
    const explanation = await createAiClient().explainRecommendations(candidates);
    const allowedDescriptions = new Map(explanation.recommendations.map((item) => [item.id, item.description]));
    return Response.json({
      summary: explanation.summary,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        description: allowedDescriptions.get(candidate.id) ?? candidate.description,
      })),
      explainedByAi: true,
    });
  } catch {
    return Response.json({
      summary: "서버가 충돌 없는 장소와 시간을 계산했습니다.",
      candidates,
      explainedByAi: false,
    });
  }
}
