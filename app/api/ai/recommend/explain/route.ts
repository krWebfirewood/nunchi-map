import { createAiClient } from "@/lib/ai/client";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateSafeCandidates } from "@/lib/recommendations/candidates";
import { findOwnSchedules, findScheduleConflicts, findScopedSchedules } from "@/lib/schedules/conflicts";
import { scheduleInputSchema } from "@/lib/schedules/schema";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = scheduleInputSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), userId: user.id });
  if (!parsed.success) return Response.json({ message: "추천할 일정 조건을 확인해 주세요." }, { status: 400 });

  const conflict = await findScheduleConflicts(parsed.data);
  if (!conflict.hasConflict) return Response.json({ message: "현재 조건에는 충돌이 없어 설명할 대안이 없습니다." }, { status: 409 });

  const [peerSchedules, ownSchedules] = await Promise.all([findScopedSchedules(parsed.data, db), findOwnSchedules(parsed.data, db)]);
  const candidates = generateSafeCandidates(parsed.data, peerSchedules, ownSchedules);
  if (candidates.length === 0) return Response.json({ message: "설명할 안전 대안이 없습니다." }, { status: 409 });

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
    return Response.json({ message: "Ollama 설명을 생성하지 못했습니다." }, { status: 503 });
  }
}
