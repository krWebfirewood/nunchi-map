"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { DEMO_LOCATIONS } from "@/lib/locations";

type User = { id: string; nickname: string };
type Schedule = { id: string; startMinutes: number; endMinutes: number; locationName: string; latitude: number; longitude: number; radiusMeters: number };
type Conflict = { hasConflict: boolean; anonymousConflictCount: number; overlapWindow: { startMinutes: number; endMinutes: number } | null; riskLevel: "low" | "medium" | "high" };

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function NunchiApp({ initialDate }: { initialDate: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [locationName, setLocationName] = useState("영등포");
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useMemo(() => DEMO_LOCATIONS.find((item) => item.name === locationName) ?? DEMO_LOCATIONS[0], [locationName]);
  const currentUser = users.find((user) => user.id === userId);

  const loadSchedules = useCallback(async () => {
    if (!userId) return setSchedules([]);
    const response = await fetch(`/api/schedules?userId=${encodeURIComponent(userId)}&date=${selectedDate}`);
    const data = await response.json();
    setSchedules(response.ok ? data.schedules : []);
  }, [selectedDate, userId]);

  useEffect(() => {
    fetch("/api/users").then((response) => response.json()).then((data: { users: User[] }) => {
      setUsers(data.users);
      setUserId((current) => current || data.users[0]?.id || "");
    });
  }, []);

  useEffect(() => { void loadSchedules(); setConflict(null); setMessage(""); }, [loadSchedules]);

  function requestBody() {
    return { userId, date: selectedDate, startMinutes: toMinutes(startTime), endMinutes: toMinutes(endTime), locationName, latitude: location.latitude, longitude: location.longitude, radiusMeters };
  }

  async function checkConflict(): Promise<Conflict | null> {
    setBusy(true); setMessage("");
    const response = await fetch("/api/schedules/conflicts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(data.message ?? "충돌 확인에 실패했습니다."); return null; }
    setConflict(data);
    return data;
  }

  async function saveSchedule() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()) });
    const data = await response.json();
    setBusy(false);
    if (response.status === 409) { setConflict(data.conflict); setMessage(data.message); return; }
    if (!response.ok) { setMessage(data.message ?? "일정 저장에 실패했습니다."); return; }
    setConflict({ hasConflict: false, anonymousConflictCount: 0, overlapWindow: null, riskLevel: "low" });
    setMessage("일정을 안전하게 등록했습니다.");
    await loadSchedules();
  }

  async function deleteSchedule(id: string) {
    const response = await fetch(`/api/schedules/${id}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json(); setMessage(data.message ?? "삭제에 실패했습니다."); return; }
    setMessage("내 일정을 삭제했습니다.");
    await loadSchedules();
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="눈치맵 홈"><span className="brand-mark" aria-hidden="true">눈</span><span>눈치맵</span></a>
        <div className="header-copy">정확한 위치는 숨기고, 겹침 가능성만 확인해요</div>
        <label className="user-switcher"><span className="sr-only">데모 사용자</span><select value={userId} onChange={(event) => setUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.nickname}</option>)}</select></label>
      </header>
      <section className="hero" id="top">
        <div><p className="eyebrow">PRIVATE ROUTE PLANNER</p><h1>마주치고 싶지 않은 날,<br />조금 다르게 움직여요.</h1><p className="hero-description">다른 사람의 이름이나 정확한 일정을 보여주지 않고,<br />선택한 시간과 지역의 익명 겹침 가능성만 알려드립니다.</p></div>
        <aside className="privacy-note"><span className="privacy-icon" aria-hidden="true">✓</span><div><strong>프라이버시 기본 설계</strong><p>충돌 결과에는 다른 사용자의 신원, 장소명, 좌표를 포함하지 않아요.</p></div></aside>
      </section>
      <section className="workspace" aria-label="일정 확인 작업 영역">
        <MonthCalendar selectedDate={selectedDate} scheduleCount={schedules.length} onSelectDate={setSelectedDate} />
        <div className={`result-panel ${conflict?.hasConflict ? "has-conflict" : ""}`}>
          <p className="eyebrow">ANONYMOUS CHECK</p>
          <h2>{conflict ? (conflict.hasConflict ? "겹칠 가능성이 있어요" : "현재 조건은 안전해요") : "일정을 입력하고 확인해 보세요"}</h2>
          {conflict?.hasConflict ? <><div className="risk-badge">위험도 {conflict.riskLevel === "high" ? "높음" : "보통"}</div><p>이 시간대와 지역에서 익명 일정 {conflict.anonymousConflictCount}개와 겹칠 가능성이 있습니다.</p>{conflict.overlapWindow && <div className="overlap-time"><span>충돌 가능 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>누구의 일정인지, 정확히 어디인지와 상세 일정은 공개하지 않습니다.</small></> : conflict ? <><div className="safe-mark">✓</div><p>겹치는 익명 일정이 없습니다. 현재 조건으로 등록할 수 있습니다.</p></> : <p>서버가 날짜·시간·거리 조건을 계산합니다. AI가 임의로 충돌을 판단하지 않습니다.</p>}
        </div>
      </section>
      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className="form-card">
          <p className="eyebrow">DIRECT INPUT</p><h2 id="schedule-title">직접 일정 등록</h2>
          <div className="schedule-form">
            <label>날짜<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <label>시작 시간<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label>종료 시간<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
            <label>장소<select value={locationName} onChange={(event) => setLocationName(event.target.value)}>{DEMO_LOCATIONS.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label>위도<input value={location.latitude} readOnly /></label><label>경도<input value={location.longitude} readOnly /></label>
            <label className="radius-field">확인 반경 <strong>{(radiusMeters / 1000).toFixed(1)}km</strong><input type="range" min="100" max="3000" step="100" value={radiusMeters} onChange={(event) => setRadiusMeters(Number(event.target.value))} /></label>
          </div>
          {message && <p className="form-message" role="status">{message}</p>}
          <div className="form-actions"><button className="secondary-button" type="button" disabled={busy || !userId} onClick={() => void checkConflict()}>{busy ? "확인 중…" : "충돌 먼저 확인"}</button><button className="primary-button" type="button" disabled={busy || !userId} onClick={() => void saveSchedule()}>일정 등록</button></div>
        </div>
        <aside className="schedule-list">
          <div><p className="eyebrow">MY SCHEDULES</p><h2>{currentUser?.nickname ?? "사용자"}님의 일정</h2><p>{selectedDate}</p></div>
          {schedules.length === 0 ? <div className="empty-state">이 날짜에 등록한 일정이 없습니다.</div> : <ul>{schedules.map((schedule) => <li key={schedule.id}><div><strong>{formatMinutes(schedule.startMinutes)}–{formatMinutes(schedule.endMinutes)}</strong><span>{schedule.locationName} · 반경 {(schedule.radiusMeters / 1000).toFixed(1)}km</span></div><button type="button" onClick={() => void deleteSchedule(schedule.id)} aria-label={`${schedule.locationName} 일정 삭제`}>삭제</button></li>)}</ul>}
        </aside>
      </section>
      <section className="composer" aria-labelledby="composer-title"><div><p className="eyebrow">NEXT: OLLAMA</p><h2 id="composer-title">자연어 일정 분석은 다음 단계예요</h2><p>현재 직접 입력과 익명 충돌 계산은 AI 없이 정상 동작합니다. 이후 qwen2.5:7b를 입력 해석과 결과 설명에만 연결합니다.</p></div><div className="input-shell"><input aria-label="자연어 일정" disabled value="이번 주 일요일 오후, 영등포에서 영화 보고 싶어" readOnly /><button type="button" disabled>AI로 분석</button></div></section>
      <footer>눈치맵은 사람을 피하는 앱이 아니라, 서로의 개인 시간을 존중하는 익명 동선 조정 서비스입니다.</footer>
    </main>
  );
}
