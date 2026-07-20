import { z } from "zod";

export const scheduleInputSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(1).max(1440),
  locationName: z.string().trim().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(1500),
  shareWithGroups: z.boolean().default(true),
}).refine((value) => value.startMinutes < value.endMinutes, {
  message: "종료 시간은 시작 시간보다 늦어야 합니다.",
  path: ["endMinutes"],
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export function dateToDatabaseValue(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}
