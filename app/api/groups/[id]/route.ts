import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canDeleteGroup, groupRoleForUser, resolveGroupOwnerId } from "@/lib/groups/policy";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const result = await db.$transaction(async (transaction) => {
    const group = await transaction.group.findUnique({
      where: { id },
      select: {
        name: true,
        ownerId: true,
        members: { select: { userId: true }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!group || !group.members.some(({ userId }) => userId === user.id)) return { status: 404 as const, name: null };
    const ownerId = resolveGroupOwnerId(group.ownerId, group.members.map(({ userId }) => userId));
    if (!canDeleteGroup(groupRoleForUser(user.id, ownerId))) return { status: 403 as const, name: group.name };
    await transaction.group.delete({ where: { id } });
    return { status: 200 as const, name: group.name };
  });

  if (result.status === 404) return Response.json({ message: "그룹을 찾을 수 없습니다." }, { status: 404 });
  if (result.status === 403) return Response.json({ message: "그룹 생성자만 그룹을 삭제할 수 있습니다." }, { status: 403 });
  return Response.json({ message: `‘${result.name}’ 그룹을 삭제했습니다.` });
}
