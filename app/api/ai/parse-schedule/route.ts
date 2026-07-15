import { z } from "zod";
import { AiConnectionError, AiResponseError, createAiClient } from "@/lib/ai/client";

const requestSchema = z.object({
  text: z.string().trim().min(2).max(500),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal("Asia/Seoul"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "분석할 일정 문장을 확인해 주세요." }, { status: 400 });
  try {
    return Response.json(await createAiClient().parseSchedule(parsed.data));
  } catch (error) {
    if (error instanceof AiConnectionError) return Response.json({
      message: "로컬 Ollama에 연결할 수 없습니다. Ollama와 모델 설정을 확인해 주세요.",
      ...(process.env.NODE_ENV === "development" ? { detail: error.message } : {}),
    }, { status: 503 });
    if (error instanceof AiResponseError) return Response.json({ message: error.message }, { status: 502 });
    return Response.json({ message: "일정 분석 중 알 수 없는 오류가 발생했습니다." }, { status: 500 });
  }
}
