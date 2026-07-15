"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { MapView } from "@/components/map/MapView";
import { DEMO_LOCATIONS } from "@/lib/locations";

type User = { id: string; nickname: string };
type Schedule = { id: string; startMinutes: number; endMinutes: number; locationName: string; latitude: number; longitude: number; radiusMeters: number };
type Conflict = { hasConflict: boolean; anonymousConflictCount: number; overlapWindow: { startMinutes: number; endMinutes: number } | null; riskLevel: "low" | "medium" | "high" };
type ParsedSchedule = { date: string; startTime: string; endTime: string; locationName: string; radiusMeters: number; assumptions: string[] };
type RecommendationCandidate = { id: string; type: "location" | "time"; title: string; description: string; locationName: string; latitude: number; longitude: number; startMinutes: number; endMinutes: number; estimatedRisk: "low" };
type Recommendation = { summary: string; candidates: RecommendationCandidate[]; explainedByAi: boolean };
type Group = { id: string; name: string; inviteCode: string; memberCount: number };

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
  const [sessionReady, setSessionReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [locationName, setLocationName] = useState("영등포");
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [naturalText, setNaturalText] = useState("이번 주 일요일 오후 2시부터 6시까지 영등포에서 영화 보고 싶어");
  const [analyzing, setAnalyzing] = useState(false);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const location = useMemo(() => DEMO_LOCATIONS.find((item) => item.name === locationName) ?? DEMO_LOCATIONS[0], [locationName]);
  const currentUser = users.find((user) => user.id === userId);
  const conflictState = conflict ? (conflict.hasConflict ? "conflict" : "safe") : "unchecked";

  const loadSchedules = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`/api/schedules?date=${selectedDate}`);
    const data = await response.json();
    setSchedules(response.ok ? data.schedules : []);
  }, [selectedDate, userId]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/users").then((response) => response.json()) as Promise<{ users: User[] }>,
      fetch("/api/session").then((response) => response.json()) as Promise<{ user: User | null }>,
    ]).then(([userData, sessionData]) => {
      setUsers(userData.users);
      setUserId(sessionData.user?.id ?? "");
    }).finally(() => setSessionReady(true));
  }, []);

  const loadGroups = useCallback(async () => {
    if (!userId) return setGroups([]);
    const response = await fetch("/api/groups");
    const data = await response.json();
    setGroups(response.ok ? data.groups : []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void fetch("/api/groups", { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setGroups(ok ? data.groups : []))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setGroups([]); });
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void fetch(`/api/schedules?userId=${encodeURIComponent(userId)}&date=${selectedDate}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setSchedules(ok ? data.schedules : []))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setSchedules([]); });
    return () => controller.abort();
  }, [selectedDate, userId]);

  function resetCheckResult() {
    setConflict(null);
    setRecommendation(null);
    setMessage("");
  }

  function requestBody() {
    return { date: selectedDate, startMinutes: toMinutes(startTime), endMinutes: toMinutes(endTime), locationName, latitude: location.latitude, longitude: location.longitude, radiusMeters };
  }

  async function checkConflict(): Promise<Conflict | null> {
    setBusy(true); setMessage(""); setRecommendation(null);
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
    const response = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json(); setMessage(data.message ?? "삭제에 실패했습니다."); return; }
    setMessage("내 일정을 삭제했습니다.");
    await loadSchedules();
  }

  async function analyzeNaturalLanguage() {
    if (naturalText.trim().length < 2) { setMessage("분석할 일정 문장을 입력해 주세요."); return; }
    setAnalyzing(true); setMessage(""); setAssumptions([]);
    try {
      const response = await fetch("/api/ai/parse-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: naturalText, today: initialDate, timezone: "Asia/Seoul" }),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "자연어 일정 분석에 실패했습니다."); return; }
      const parsed = data as ParsedSchedule;
      setSelectedDate(parsed.date);
      setStartTime(parsed.startTime);
      setEndTime(parsed.endTime);
      setLocationName(parsed.locationName);
      setRadiusMeters(parsed.radiusMeters);
      setAssumptions(parsed.assumptions);
      setConflict(null);
      setRecommendation(null);
      setMessage("Ollama 분석 결과를 직접 입력 폼에 반영했습니다. 내용을 확인한 뒤 충돌을 검사하세요.");
    } catch {
      setMessage("Ollama 분석 요청에 실패했습니다. 직접 입력은 계속 사용할 수 있습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function requestRecommendations() {
    setRecommending(true); setMessage(""); setRecommendation(null);
    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody()),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "대안 추천에 실패했습니다."); return; }
      setRecommendation(data as Recommendation);
    } catch {
      setMessage("대안 추천 요청에 실패했습니다.");
    } finally {
      setRecommending(false);
    }
  }

  function applyCandidate(candidate: RecommendationCandidate) {
    setLocationName(candidate.locationName);
    setStartTime(formatMinutes(candidate.startMinutes));
    setEndTime(formatMinutes(candidate.endMinutes));
    setConflict(null);
    setRecommendation(null);
    setMessage(`‘${candidate.title}’ 대안을 입력 폼에 반영했습니다. 충돌을 다시 확인해 주세요.`);
  }

  async function login(selectedUserId: string) {
    setMessage("");
    const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.message ?? "로그인에 실패했습니다."); return; }
    setUserId(data.user.id);
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setUserId(""); setSchedules([]); setGroups([]); resetCheckResult();
  }

  async function createGroup() {
    setGroupBusy(true); setGroupMessage("");
    const response = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName }) });
    const data = await response.json();
    setGroupBusy(false);
    if (!response.ok) { setGroupMessage(data.message ?? "그룹 생성에 실패했습니다."); return; }
    setGroupName(""); setGroupMessage(`‘${data.group.name}’ 그룹을 만들었습니다.`); await loadGroups();
  }

  async function joinGroup() {
    setGroupBusy(true); setGroupMessage("");
    const response = await fetch("/api/groups/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode }) });
    const data = await response.json();
    setGroupBusy(false);
    if (!response.ok) { setGroupMessage(data.message ?? "그룹 참여에 실패했습니다."); return; }
    setInviteCode(""); setGroupMessage(`‘${data.group.name}’ 그룹에 참여했습니다.`); await loadGroups();
  }

  if (!sessionReady) return <main className="session-screen"><div className="session-card"><p className="eyebrow">PRIVATE SESSION</p><h1>눈치맵을 준비하고 있어요</h1></div></main>;

  if (!userId) return <main className="session-screen"><section className="session-card"><span className="brand-mark" aria-hidden="true">눈</span><p className="eyebrow">LOCAL DEMO SESSION</p><h1>누구의 일정으로<br />확인할까요?</h1><p>선택한 사용자는 브라우저의 안전한 세션 쿠키에만 저장됩니다.</p><div className="session-users">{users.map((user) => <button key={user.id} type="button" onClick={() => void login(user.id)}><strong>{user.nickname}</strong><span>이 사용자로 시작</span></button>)}</div>{message && <p className="form-message" role="status">{message}</p>}</section></main>;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="눈치맵 홈"><span className="brand-mark" aria-hidden="true">눈</span><span>눈치맵</span></a>
        <div className="header-copy">정확한 위치는 숨기고, 겹침 가능성만 확인해요</div>
        <div className="session-user"><span>{currentUser?.nickname}</span><button type="button" onClick={() => void logout()}>로그아웃</button></div>
      </header>
      <section className="hero" id="top">
        <div><p className="eyebrow">PRIVATE ROUTE PLANNER</p><h1>마주치고 싶지 않은 날,<br />조금 다르게 움직여요.</h1><p className="hero-description">다른 사람의 이름이나 정확한 일정을 보여주지 않고,<br />선택한 시간과 지역의 익명 겹침 가능성만 알려드립니다.</p></div>
        <aside className="privacy-note"><span className="privacy-icon" aria-hidden="true">✓</span><div><strong>프라이버시 기본 설계</strong><p>충돌 결과에는 다른 사용자의 신원, 장소명, 좌표를 포함하지 않아요.</p></div></aside>
      </section>
      <section className="workspace" aria-label="일정 확인 작업 영역">
        <MonthCalendar selectedDate={selectedDate} scheduleCount={schedules.length} onSelectDate={(date) => { setSelectedDate(date); resetCheckResult(); }} />
        <div className="map-stack">
          <MapView locationName={locationName} latitude={location.latitude} longitude={location.longitude} radiusMeters={radiusMeters} conflictState={conflictState} />
          <div className={`result-panel ${conflict?.hasConflict ? "has-conflict" : ""}`}>
            <p className="eyebrow">ANONYMOUS CHECK</p>
            <h2>{conflict ? (conflict.hasConflict ? "겹칠 가능성이 있어요" : "현재 조건은 안전해요") : "일정을 입력하고 확인해 보세요"}</h2>
            {conflict?.hasConflict ? <><div className="risk-badge">위험도 {conflict.riskLevel === "high" ? "높음" : "보통"}</div><p>이 시간대와 지역에서 익명 일정 {conflict.anonymousConflictCount}개와 겹칠 가능성이 있습니다.</p>{conflict.overlapWindow && <div className="overlap-time"><span>충돌 가능 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>지도 원은 요청한 확인 범위를 표시하며, 타인의 정확한 위치는 포함하지 않습니다.</small></> : conflict ? <><div className="safe-mark">✓</div><p>겹치는 익명 일정이 없습니다. 현재 조건으로 등록할 수 있습니다.</p></> : <p>서버가 날짜·시간·거리 조건을 계산합니다. AI가 임의로 충돌을 판단하지 않습니다.</p>}
            {conflict?.hasConflict && <button className="recommend-button" type="button" disabled={recommending} onClick={() => void requestRecommendations()}>{recommending ? "안전 후보 계산·설명 중…" : "안전한 대안 추천 받기"}</button>}
            {recommendation && <div className="recommendation-box"><div className="recommendation-heading"><strong>{recommendation.summary}</strong><span>{recommendation.explainedByAi ? "Ollama 설명" : "서버 계산 결과"}</span></div>{recommendation.candidates.length === 0 ? <p>날짜나 확인 반경을 바꾼 뒤 다시 시도해 주세요.</p> : <ul>{recommendation.candidates.map((candidate) => <li key={candidate.id}><div><strong>{candidate.title}</strong><p>{candidate.description}</p></div><button type="button" onClick={() => applyCandidate(candidate)}>적용</button></li>)}</ul>}</div>}
          </div>
        </div>
      </section>
      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className="form-card">
          <p className="eyebrow">DIRECT INPUT</p><h2 id="schedule-title">직접 일정 등록</h2>
          <div className="schedule-form">
            <label>날짜<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); resetCheckResult(); }} /></label>
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
      <section className="group-section" aria-labelledby="group-title">
        <div><p className="eyebrow">PRIVATE GROUPS</p><h2 id="group-title">충돌 확인 범위를 그룹으로 관리해요</h2><p>같은 비공개 그룹에 참여한 구성원의 일정만 익명으로 비교합니다. 구성원 이름이나 상세 일정은 표시하지 않습니다.</p></div>
        <div className="group-tools">
          <div className="group-form"><label>새 그룹 이름<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="예: 디자인팀 주말" /></label><button type="button" disabled={groupBusy} onClick={() => void createGroup()}>그룹 만들기</button></div>
          <div className="group-form"><label>초대 코드<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="예: NUNCHI" /></label><button type="button" disabled={groupBusy} onClick={() => void joinGroup()}>그룹 참여</button></div>
          {groupMessage && <p className="form-message" role="status">{groupMessage}</p>}
        </div>
        <div className="group-list">{groups.length === 0 ? <div className="empty-state">참여한 그룹이 없습니다. 그룹을 만들거나 초대 코드로 참여해 주세요.</div> : groups.map((group) => <article key={group.id}><div><strong>{group.name}</strong><span>익명 구성원 {group.memberCount}명</span></div><div><span>초대 코드</span><code>{group.inviteCode}</code></div></article>)}</div>
      </section>
      <section className="composer" aria-labelledby="composer-title">
        <div><p className="eyebrow">LOCAL OLLAMA</p><h2 id="composer-title">말하듯 입력해도 괜찮아요</h2><p>환경변수로 선택한 로컬 Ollama 모델이 문장을 구조화하고, 서버가 결과 형식을 다시 검증합니다.</p></div>
        <div className="ai-composer">
          <div className="input-shell"><textarea aria-label="자연어 일정" value={naturalText} onChange={(event) => setNaturalText(event.target.value)} rows={3} /><button type="button" disabled={analyzing} onClick={() => void analyzeNaturalLanguage()}>{analyzing ? "분석 중…" : "AI로 분석"}</button></div>
          {assumptions.length > 0 && <div className="assumption-box"><strong>AI가 적용한 해석</strong><ul>{assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}
        </div>
      </section>
      <footer>눈치맵은 사람을 피하는 앱이 아니라, 서로의 개인 시간을 존중하는 익명 동선 조정 서비스입니다.</footer>
    </main>
  );
}
