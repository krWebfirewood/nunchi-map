import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.session.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.createMany({ data: [{ id: "demo-kim", nickname: "김눈치" }, { id: "demo-weekend", nickname: "주말인간B" }, { id: "demo-anonymous", nickname: "익명직원C" }] });
  await prisma.group.create({
    data: {
      id: "demo-company",
      name: "눈치 좋은 동료들",
      inviteCode: "NUNCHI",
      members: { create: [{ userId: "demo-kim" }, { userId: "demo-weekend" }, { userId: "demo-anonymous" }] },
    },
  });
  await prisma.schedule.createMany({ data: [
    { userId: "demo-kim", date: new Date("2026-07-19T00:00:00+09:00"), startMinutes: 780, endMinutes: 1020, locationName: "영등포", latitude: 37.5159, longitude: 126.9075, radiusMeters: 1500 },
    { userId: "demo-weekend", date: new Date("2026-07-19T00:00:00+09:00"), startMinutes: 900, endMinutes: 1140, locationName: "홍대입구", latitude: 37.5572, longitude: 126.9254, radiusMeters: 1200 },
    { userId: "demo-anonymous", date: new Date("2026-07-20T00:00:00+09:00"), startMinutes: 720, endMinutes: 960, locationName: "용산", latitude: 37.5299, longitude: 126.9648, radiusMeters: 1500 }
  ] });
}

main().finally(async () => prisma.$disconnect());
