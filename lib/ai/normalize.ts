import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { DEMO_LOCATIONS } from "@/lib/locations";
import { parsedScheduleSchema, type ParsedSchedule } from "./schemas";

const WEEKDAY_INDEX: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };

function toHour(period: string | undefined, hour: number): number {
  if (period === "오전") return hour === 12 ? 0 : hour;
  if (period === "오후" || period === "저녁" || period === "밤") return hour < 12 ? hour + 12 : hour;
  return hour;
}

function explicitTimeRange(text: string): { startTime: string; endTime: string } | null {
  const match = text.match(/(오전|오후|저녁|밤)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?\s*부터\s*(오전|오후|저녁|밤)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?\s*까지/);
  if (!match) return null;
  const startPeriod = match[1];
  const endPeriod = match[4] ?? startPeriod;
  const startHour = toHour(startPeriod, Number(match[2]));
  let endHour = toHour(endPeriod, Number(match[5]));
  if (!startPeriod && !match[4] && startHour >= 12 && endHour < startHour) endHour += 12;
  const startMinutes = Number(match[3] ?? 0);
  const endMinutes = Number(match[6] ?? 0);
  const time = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { startTime: time(startHour, startMinutes), endTime: time(endHour, endMinutes) };
}

function relativeWeekday(text: string, today: string): string | null {
  const todayDate = parseISO(`${today}T12:00:00`);
  if (text.includes("모레")) return format(addDays(todayDate, 2), "yyyy-MM-dd");
  if (text.includes("내일")) return format(addDays(todayDate, 1), "yyyy-MM-dd");
  if (text.includes("오늘")) return format(todayDate, "yyyy-MM-dd");
  const match = text.match(/(이번|다음)\s*주\s*(월|화|수|목|금|토|일)요일/);
  if (!match) return null;
  const monday = startOfWeek(parseISO(`${today}T12:00:00`), { weekStartsOn: 1 });
  const weekOffset = match[1] === "다음" ? 7 : 0;
  return format(addDays(monday, weekOffset + WEEKDAY_INDEX[match[2]]), "yyyy-MM-dd");
}

function explicitLocationName(text: string): string | null {
  const knownLocation = DEMO_LOCATIONS.find((location) => text.includes(location.name));
  if (knownLocation) return knownLocation.name;
  const match = text.match(/(?:오늘|내일|모레|(?:이번|다음)\s*주\s*[월화수목금토일]요일)\s+(.{1,80}?)\s+(?=(?:오전|오후|저녁|밤)?\s*\d{1,2}시)/);
  return match?.[1]?.trim() || null;
}

export function normalizeParsedSchedule(text: string, today: string, parsed: ParsedSchedule): ParsedSchedule {
  const explicitLocation = explicitLocationName(text);
  const correctedTime = explicitTimeRange(text);
  const correctedDate = relativeWeekday(text, today);
  return parsedScheduleSchema.parse({
    ...parsed,
    ...(correctedDate ? { date: correctedDate } : {}),
    ...(correctedTime ?? {}),
    ...(explicitLocation ? { locationName: explicitLocation } : {}),
    assumptions: explicitLocation
      ? parsed.assumptions.filter((assumption) => !assumption.includes("가장 가까운"))
      : parsed.assumptions,
  });
}

export function createParsedScheduleDraft(text: string, today: string): ParsedSchedule | null {
  const locationName = explicitLocationName(text);
  const time = explicitTimeRange(text);
  const date = relativeWeekday(text, today);
  if (!locationName || !time || !date) return null;
  return parsedScheduleSchema.parse({
    date,
    ...time,
    locationName,
    radiusMeters: 1500,
    preferences: {
      maxTravelMinutes: null,
      needsCinema: text.includes("영화") ? true : null,
      needsCafe: text.includes("카페") ? true : null,
    },
    assumptions: ["문장에 명시된 날짜·시간·장소로 만든 빠른 초안입니다."],
  });
}
