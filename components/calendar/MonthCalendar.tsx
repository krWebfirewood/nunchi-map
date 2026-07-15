"use client";

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import type { CalendarDaySummary, CalendarMonthSummary, CalendarRiskStatus } from "@/lib/schedules/monthSummary";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface MonthCalendarProps {
  selectedDate: string;
  scheduleCount: number;
  refreshKey: number;
  onSelectDate: (date: string) => void;
}

const STATUS_LABEL: Record<CalendarRiskStatus, string> = {
  safe: "충돌 없음",
  medium: "충돌 주의",
  high: "충돌 가능성 높음",
  private: "나만 보기",
};

function summaryDescription(summary: CalendarDaySummary): string {
  const visibility = summary.privateCount === summary.scheduleCount
    ? "모두 나만 보기"
    : summary.privateCount > 0
      ? `공유 ${summary.sharedCount}개, 나만 보기 ${summary.privateCount}개`
      : `공유 ${summary.sharedCount}개`;
  return `내 일정 ${summary.scheduleCount}개, ${visibility}, ${STATUS_LABEL[summary.riskStatus]}`;
}

export function MonthCalendar({ selectedDate, scheduleCount, refreshKey, onSelectDate }: MonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const selected = parseISO(`${selectedDate}T12:00:00`);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(selected));
  const [loadedSummary, setLoadedSummary] = useState<{ month: string; days: CalendarMonthSummary }>({ month: "", days: {} });
  const visibleMonthKey = format(visibleMonth, "yyyy-MM");
  const monthSummary = loadedSummary.month === visibleMonthKey ? loadedSummary.days : {};
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(visibleMonth)), end: endOfWeek(endOfMonth(visibleMonth)) });

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/schedules/month-summary?month=${visibleMonthKey}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setLoadedSummary({ month: visibleMonthKey, days: ok ? data.days : {} }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadedSummary({ month: visibleMonthKey, days: {} });
      });
    return () => controller.abort();
  }, [refreshKey, visibleMonthKey]);

  return (
    <article className="calendar-card">
      <div className="calendar-heading">
        <div><p className="eyebrow">MONTHLY VIEW</p><h2>{format(visibleMonth, "yyyy년 M월", { locale: ko })}</h2></div>
        <div className="month-controls">
          <button type="button" onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))} aria-label="이전 달">‹</button>
          <button type="button" onClick={() => { setVisibleMonth(startOfMonth(today)); onSelectDate(format(today, "yyyy-MM-dd")); }}>오늘</button>
          <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} aria-label="다음 달">›</button>
        </div>
      </div>
      <div className="calendar-grid weekday-row">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid day-grid">
        {days.map((day) => {
          const isSelected = isSameDay(day, selected);
          const dateKey = format(day, "yyyy-MM-dd");
          const summary = monthSummary[dateKey];
          const description = summary ? summaryDescription(summary) : "등록된 내 일정 없음";
          const label = `${format(day, "yyyy년 M월 d일", { locale: ko })}, ${description}`;
          return <button type="button" key={day.toISOString()} className={`${isSelected ? "selected" : ""} ${isSameMonth(day, visibleMonth) ? "" : "muted"}`} onClick={() => onSelectDate(dateKey)} aria-pressed={isSelected} aria-label={label} title={description}><span className="calendar-day-number">{format(day, "d")}</span>{summary && <span className={`calendar-status ${summary.riskStatus}`} aria-hidden="true"><i />{summary.scheduleCount}</span>}{isSameDay(day, today) && <small className="calendar-today">오늘</small>}</button>;
        })}
      </div>
      <div className="calendar-legend" aria-label="일정 상태 범례">
        {(["safe", "medium", "high", "private"] as const).map((status) => <span key={status}><i className={status} />{STATUS_LABEL[status]}</span>)}
      </div>
      <div className="selected-date"><span>선택한 날짜</span><strong>{format(selected, "M월 d일 EEEE", { locale: ko })}</strong><em>등록된 내 일정 {scheduleCount}개</em></div>
    </article>
  );
}
