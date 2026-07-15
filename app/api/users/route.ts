import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.findMany({ select: { id: true, nickname: true }, orderBy: { createdAt: "asc" } });
  return Response.json({ users });
}
