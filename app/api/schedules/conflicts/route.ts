import { findAnonymousConflicts } from "@/lib/schedules/conflicts";
import { scheduleInputSchema } from "@/lib/schedules/schema";

export async function POST(request: Request) {
  const parsed = scheduleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "입력값을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  return Response.json(await findAnonymousConflicts(parsed.data));
}
