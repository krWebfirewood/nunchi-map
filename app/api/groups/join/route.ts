import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { groupRoleForUser, resolveGroupOwnerId } from "@/lib/groups/policy";

const joinSchema = z.object({ inviteCode: z.string().trim().min(4).max(12).transform((value) => value.toUpperCase()) });

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "초대 코드를 확인해 주세요." }, { status: 400 });
  const group = await db.group.findUnique({ where: { inviteCode: parsed.data.inviteCode }, select: {
    id: true,
    name: true,
    inviteCode: true,
    ownerId: true,
    members: { select: { userId: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] },
  } });
  if (!group) return Response.json({ message: "일치하는 그룹이 없습니다." }, { status: 404 });
  await db.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id },
  });
  const memberCount = await db.groupMember.count({ where: { groupId: group.id } });
  const ownerId = resolveGroupOwnerId(group.ownerId, group.members.map(({ userId }) => userId));
  return Response.json({ group: { id: group.id, name: group.name, inviteCode: group.inviteCode, memberCount, role: groupRoleForUser(user.id, ownerId) } });
}
