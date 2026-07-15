import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { groupRoleForUser, resolveGroupOwnerId } from "@/lib/groups/policy";

const createGroupSchema = z.object({ name: z.string().trim().min(2).max(40) });

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const memberships = await db.groupMember.findMany({
    where: { userId: user.id },
    select: { group: { select: {
      id: true,
      name: true,
      inviteCode: true,
      ownerId: true,
      members: { select: { userId: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] },
      _count: { select: { members: true } },
    } } },
    orderBy: { joinedAt: "asc" },
  });
  return Response.json({ groups: memberships.map(({ group }) => {
    const ownerId = resolveGroupOwnerId(group.ownerId, group.members.map(({ userId }) => userId));
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      memberCount: group._count.members,
      role: groupRoleForUser(user.id, ownerId),
    };
  }) });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const parsed = createGroupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "그룹 이름은 2~40자로 입력해 주세요." }, { status: 400 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = randomBytes(3).toString("hex").toUpperCase();
    try {
      const group = await db.group.create({
        data: { name: parsed.data.name, inviteCode, ownerId: user.id, members: { create: { userId: user.id } } },
        select: { id: true, name: true, inviteCode: true },
      });
      return Response.json({ group: { ...group, memberCount: 1, role: "owner" as const } }, { status: 201 });
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  return Response.json({ message: "초대 코드 생성에 실패했습니다." }, { status: 500 });
}
