import { z } from "zod";
import { createParsedScheduleDraft } from "@/lib/ai/normalize";

const requestSchema = z.object({
  text: z.string().trim().min(2).max(500),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal("Asia/Seoul"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "분석할 일정 문장을 확인해 주세요." }, { status: 400 });
  const draft = createParsedScheduleDraft(parsed.data.text, parsed.data.today);
  if (!draft) return Response.json({ message: "빠른 초안을 만들기에는 날짜·시간·장소 정보가 부족합니다." }, { status: 422 });
  return Response.json(draft);
}
