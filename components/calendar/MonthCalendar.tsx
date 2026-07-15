"use client";

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface MonthCalendarProps {
  selectedDate: string;
  scheduleCount: number;
  onSelectDate: (date: string) => void;
}

export function MonthCalendar({ selectedDate, scheduleCount, onSelectDate }: MonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const selected = parseISO(`${selectedDate}T12:00:00`);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(selected));
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(visibleMonth)), end: endOfWeek(endOfMonth(visibleMonth)) });

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
          return <button type="button" key={day.toISOString()} className={`${isSelected ? "selected" : ""} ${isSameMonth(day, visibleMonth) ? "" : "muted"}`} onClick={() => onSelectDate(format(day, "yyyy-MM-dd"))} aria-pressed={isSelected} aria-label={format(day, "yyyy년 M월 d일", { locale: ko })}><span>{format(day, "d")}</span>{isSameDay(day, today) && <small>오늘</small>}</button>;
        })}
      </div>
      <div className="selected-date"><span>선택한 날짜</span><strong>{format(selected, "M월 d일 EEEE", { locale: ko })}</strong><em>등록된 내 일정 {scheduleCount}개</em></div>
    </article>
  );
}
