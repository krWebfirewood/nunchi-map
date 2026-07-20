import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { liveLocationExpiresAt, liveLocationInputSchema, liveLocationStopSchema } from "@/lib/locations/live";

async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  return membership !== null;
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const groupId = new URL(request.url).searchParams.get("groupId") ?? "";
  if (!groupId) return Response.json({ message: "그룹을 선택해 주세요." }, { status: 400 });
  if (!(await isGroupMember(user.id, groupId))) {
    return Response.json({ message: "참여 중인 그룹의 위치만 볼 수 있습니다." }, { status: 403 });
  }

  const now = new Date();
  const locations = await db.liveLocation.findMany({
    where: { groupId, expiresAt: { gt: now } },
    select: {
      userId: true,
      latitude: true,
      longitude: true,
      accuracyMeters: true,
      updatedAt: true,
      user: { select: { nickname: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({
    locations: locations.map(({ user: locationUser, ...location }) => ({
      ...location,
      nickname: locationUser.nickname,
      isMe: location.userId === user.id,
    })),
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const parsed = liveLocationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "현재 위치 정보가 올바르지 않습니다." }, { status: 400 });
  if (!(await isGroupMember(user.id, parsed.data.groupId))) {
    return Response.json({ message: "참여 중인 그룹에만 위치를 공유할 수 있습니다." }, { status: 403 });
  }

  const { groupId, latitude, longitude, accuracyMeters } = parsed.data;
  const location = await db.liveLocation.upsert({
    where: { userId_groupId: { userId: user.id, groupId } },
    create: { userId: user.id, groupId, latitude, longitude, accuracyMeters, expiresAt: liveLocationExpiresAt() },
    update: { latitude, longitude, accuracyMeters, expiresAt: liveLocationExpiresAt() },
    select: { updatedAt: true, expiresAt: true },
  });

  return Response.json({ location });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const parsed = liveLocationStopSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "그룹을 선택해 주세요." }, { status: 400 });

  await db.liveLocation.deleteMany({ where: { userId: user.id, groupId: parsed.data.groupId } });
  return Response.json({ stopped: true });
}
