import { db } from "@/lib/db";
import { databaseUnavailableResponse } from "@/lib/http/database";

export async function GET() {
  try {
    const users = await db.user.findMany({ where: { loginId: null }, select: { id: true, nickname: true }, orderBy: { createdAt: "asc" } });
    return Response.json({ users });
  } catch (error) {
    return databaseUnavailableResponse("demo user lookup failed", error);
  }
}
