export type GroupRole = "owner" | "member";

export function resolveGroupOwnerId(ownerId: string | null, orderedMemberIds: string[]): string | null {
  return ownerId ?? orderedMemberIds[0] ?? null;
}

export function groupRoleForUser(userId: string, ownerId: string | null): GroupRole {
  return userId === ownerId ? "owner" : "member";
}

export function canLeaveGroup(role: GroupRole): boolean {
  return role === "member";
}

export function canDeleteGroup(role: GroupRole): boolean {
  return role === "owner";
}
