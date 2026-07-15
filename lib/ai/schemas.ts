import { z } from "zod";

export const parsedScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  locationName: z.string().trim().min(1).max(80),
  radiusMeters: z.number().int().min(100).max(3000),
  preferences: z.object({
    maxTravelMinutes: z.number().int().positive().nullable(),
    needsCinema: z.boolean().nullable(),
    needsCafe: z.boolean().nullable(),
  }),
  assumptions: z.array(z.string()),
}).refine((value) => value.startTime < value.endTime, {
  message: "종료 시간은 시작 시간보다 늦어야 합니다.",
  path: ["endTime"],
});

export type ParsedSchedule = z.infer<typeof parsedScheduleSchema>;

export const ollamaScheduleSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  locationName: z.string(),
  radiusMeters: z.number().int(),
  assumptions: z.array(z.string()),
});

export const parsedScheduleJsonSchema = {
  type: "object",
  properties: {
    date: { type: "string" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    locationName: { type: "string", minLength: 1, maxLength: 80 },
    radiusMeters: { type: "integer", minimum: 100, maximum: 3000 },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["date", "startTime", "endTime", "locationName", "radiusMeters", "assumptions"],
  additionalProperties: false,
} as const;
