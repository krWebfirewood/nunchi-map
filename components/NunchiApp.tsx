"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { LocationSearch, type SelectedLocation } from "@/components/map/LocationSearch";
import { MapView, type MapSchedule } from "@/components/map/MapView";
import { DEMO_LOCATIONS } from "@/lib/locations";
import { searchKakaoPlaces } from "@/lib/kakao/maps";

type User = { id: string; nickname: string };
type Schedule = MapSchedule & { source: "own"; riskLevel: "low" | "medium" | "high"; shareWithGroups: boolean };
type Conflict = { hasConflict: boolean; ownScheduleConflict: boolean; anonymousConflictCount: number; overlapWindow: { startMinutes: number; endMinutes: number } | null; riskLevel: "low" | "medium" | "high" };
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
  const [sessionNickname, setSessionNickname] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authLoginId, setAuthLoginId] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNickname, setAuthNickname] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groupSchedules, setGroupSchedules] = useState<MapSchedule[]>([]);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [locationName, setLocationName] = useState("영등포");
  const [locationAddress, setLocationAddress] = useState("영등포 중심");
  const [latitude, setLatitude] = useState<number>(DEMO_LOCATIONS[0].latitude);
  const [longitude, setLongitude] = useState<number>(DEMO_LOCATIONS[0].longitude);
  const [locationResolved, setLocationResolved] = useState(true);
  const [radiusMeters, setRadiusMeters] = useState(1500);
  const [shareWithGroups, setShareWithGroups] = useState(true);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [sharingScheduleId, setSharingScheduleId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const [naturalText, setNaturalText] = useState("이번 주 일요일 오후 2시부터 6시까지 영등포에서 영화 보고 싶어");
  const [draftingSchedule, setDraftingSchedule] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const parsingRequestRef = useRef<AbortController | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [explainingRecommendation, setExplainingRecommendation] = useState(false);
  const recommendationRequestRef = useRef<AbortController | null>(null);
  const mapSchedules = useMemo(() => [...schedules, ...groupSchedules], [groupSchedules, schedules]);
  const currentUser = users.find((user) => user.id === userId) ?? (userId ? { id: userId, nickname: sessionNickname } : undefined);
  const conflictState = conflict ? (conflict.hasConflict ? "conflict" : "safe") : "unchecked";

  const loadSchedules = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`/api/schedules?date=${selectedDate}`);
    const data = await response.json();
    setSchedules(response.ok ? data.schedules : []);
    setGroupSchedules(response.ok ? data.groupSchedules : []);
  }, [selectedDate, userId]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/users").then((response) => response.json()) as Promise<{ users: User[] }>,
      fetch("/api/session").then((response) => response.json()) as Promise<{ user: User | null }>,
    ]).then(([userData, sessionData]) => {
      setUsers(userData.users);
      setUserId(sessionData.user?.id ?? "");
      setSessionNickname(sessionData.user?.nickname ?? "");
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
    void fetch(`/api/schedules?date=${selectedDate}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => { setSchedules(ok ? data.schedules : []); setGroupSchedules(ok ? data.groupSchedules : []); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) { setSchedules([]); setGroupSchedules([]); } });
    return () => controller.abort();
  }, [selectedDate, userId]);

  function resetCheckResult() {
    recommendationRequestRef.current?.abort();
    parsingRequestRef.current?.abort();
    setConflict(null);
    setRecommendation(null);
    setRecommending(false);
    setExplainingRecommendation(false);
    setDraftingSchedule(false);
    setAnalyzing(false);
    setMessage("");
  }

  function requestBody() {
    return { date: selectedDate, startMinutes: toMinutes(startTime), endMinutes: toMinutes(endTime), locationName, latitude, longitude, radiusMeters, shareWithGroups };
  }

  function selectLocation(location: SelectedLocation) {
    setLocationName(location.name);
    setLocationAddress(location.address);
    setLatitude(location.latitude);
    setLongitude(location.longitude);
    setLocationResolved(true);
    resetCheckResult();
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
    const response = await fetch(editingScheduleId ? `/api/schedules/${editingScheduleId}` : "/api/schedules", { method: editingScheduleId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()) });
    const data = await response.json();
    setBusy(false);
    if (response.status === 409) { setConflict(data.conflict); setMessage(data.message); return; }
    if (!response.ok) { setMessage(data.message ?? "일정 저장에 실패했습니다."); return; }
    setConflict(data.conflict);
    setMessage(data.message);
    setEditingScheduleId(null);
    await loadSchedules();
  }

  function beginEdit(schedule: Schedule) {
    setEditingScheduleId(schedule.id);
    setStartTime(formatMinutes(schedule.startMinutes));
    setEndTime(formatMinutes(schedule.endMinutes));
    setLocationName(schedule.locationName);
    setLocationAddress("등록된 일정 위치");
    setLatitude(schedule.latitude);
    setLongitude(schedule.longitude);
    setRadiusMeters(schedule.radiusMeters);
    setShareWithGroups(schedule.shareWithGroups);
    resetCheckResult();
    requestAnimationFrame(() => formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function cancelEdit() {
    setEditingScheduleId(null);
    resetCheckResult();
    setMessage("일정 수정을 취소했습니다.");
  }

  async function deleteSchedule(id: string) {
    if (deletingScheduleId) return;
    setDeletingScheduleId(id);
    try {
      const response = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(data?.message ?? "삭제에 실패했습니다.");
        await loadSchedules();
        return;
      }
      setMessage("내 일정을 삭제했습니다.");
      if (editingScheduleId === id) setEditingScheduleId(null);
      await loadSchedules();
    } catch {
      setMessage("일정 삭제 요청에 실패했습니다.");
    } finally {
      setDeletingScheduleId(null);
    }
  }

  async function toggleScheduleSharing(schedule: Schedule) {
    if (sharingScheduleId || deletingScheduleId) return;
    setSharingScheduleId(schedule.id);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareWithGroups: !schedule.shareWithGroups }),
      });
      const data = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setMessage(data?.message ?? "공유 설정 변경에 실패했습니다.");
        return;
      }
      setMessage(data?.message ?? "공유 설정을 변경했습니다.");
      await loadSchedules();
    } catch {
      setMessage("공유 설정 변경 요청에 실패했습니다.");
    } finally {
      setSharingScheduleId(null);
    }
  }

  async function analyzeNaturalLanguage() {
    if (naturalText.trim().length < 2) { setMessage("분석할 일정 문장을 입력해 주세요."); return; }
    parsingRequestRef.current?.abort();
    const controller = new AbortController();
    parsingRequestRef.current = controller;
    const body = JSON.stringify({ text: naturalText, today: initialDate, timezone: "Asia/Seoul" });
    setDraftingSchedule(true); setAnalyzing(false); setMessage(""); setAssumptions([]);
    try {
      const previewResponse = await fetch("/api/ai/parse-schedule/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (previewResponse.ok) {
        const locationFound = await applyParsedSchedule(await previewResponse.json() as ParsedSchedule);
        if (locationFound) setMessage("빠른 초안을 입력 폼에 반영했습니다. Ollama가 뒤에서 내용을 확인하고 있어요.");
      }
      setDraftingSchedule(false);
      setAnalyzing(true);

      const response = await fetch("/api/ai/parse-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "자연어 일정 분석에 실패했습니다."); return; }
      const locationFound = await applyParsedSchedule(data as ParsedSchedule);
      if (locationFound) setMessage("Ollama 분석 결과와 장소 좌표를 입력 폼에 반영했습니다. 내용을 확인한 뒤 충돌을 검사하세요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Ollama 분석 요청에 실패했습니다. 직접 입력은 계속 사용할 수 있습니다.");
    } finally {
      if (parsingRequestRef.current === controller) {
        setDraftingSchedule(false);
        setAnalyzing(false);
        parsingRequestRef.current = null;
      }
    }
  }

  async function applyParsedSchedule(parsed: ParsedSchedule): Promise<boolean> {
    setSelectedDate(parsed.date);
    setStartTime(parsed.startTime);
    setEndTime(parsed.endTime);
    setLocationName(parsed.locationName);
    const knownLocation = DEMO_LOCATIONS.find((item) => item.name === parsed.locationName);
    if (knownLocation) {
      setLocationAddress(`${knownLocation.name} 중심`);
      setLatitude(knownLocation.latitude);
      setLongitude(knownLocation.longitude);
      setLocationResolved(true);
    } else {
      setLocationAddress("카카오 지도에서 좌표 찾는 중…");
      setLocationResolved(false);
      const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";
      if (!appKey) {
        setMessage("카카오 지도 키가 없어 장소 좌표를 찾지 못했습니다. 직접 장소를 검색해 선택해 주세요.");
        return false;
      }
      try {
        const [place] = await searchKakaoPlaces(appKey, parsed.locationName, 1);
        if (!place) {
          setLocationAddress("좌표를 찾지 못함");
          setMessage(`‘${parsed.locationName}’의 좌표를 찾지 못했습니다. 직접 장소 검색에서 선택해 주세요.`);
          return false;
        }
        setLocationName(place.place_name);
        setLocationAddress(place.road_address_name || place.address_name);
        setLatitude(Number(place.y));
        setLongitude(Number(place.x));
        setLocationResolved(true);
      } catch {
        setLocationAddress("좌표 검색 실패");
        setMessage("장소 좌표 검색에 실패했습니다. 직접 장소 검색에서 선택해 주세요.");
        return false;
      }
    }
    setRadiusMeters(parsed.radiusMeters);
    setAssumptions(parsed.assumptions);
    setConflict(null);
    setRecommendation(null);
    return true;
  }

  async function requestRecommendations() {
    recommendationRequestRef.current?.abort();
    const controller = new AbortController();
    recommendationRequestRef.current = controller;
    const body = JSON.stringify(requestBody());
    setRecommending(true); setExplainingRecommendation(false); setMessage(""); setRecommendation(null);
    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "대안 추천에 실패했습니다."); return; }
      setRecommendation(data as Recommendation);
      setRecommending(false);
      if (data.candidates.length === 0) return;

      setExplainingRecommendation(true);
      const explanationResponse = await fetch("/api/ai/recommend/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (explanationResponse.ok) setRecommendation(await explanationResponse.json() as Recommendation);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("대안 추천 요청에 실패했습니다.");
    } finally {
      if (recommendationRequestRef.current === controller) {
        setRecommending(false);
        setExplainingRecommendation(false);
        recommendationRequestRef.current = null;
      }
    }
  }

  function applyCandidate(candidate: RecommendationCandidate) {
    recommendationRequestRef.current?.abort();
    setLocationName(candidate.locationName);
    setLocationAddress(`${candidate.locationName} 추천 위치`);
    setLatitude(candidate.latitude);
    setLongitude(candidate.longitude);
    setLocationResolved(true);
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
    setSessionNickname(data.user.nickname);
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthMessage("");
    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: authLoginId, password: authPassword, ...(authMode === "signup" ? { nickname: authNickname } : {}) }),
    });
    const data = await response.json().catch(() => null) as { message?: string; user?: User } | null;
    setAuthBusy(false);
    if (!response.ok || !data?.user) { setAuthMessage(data?.message ?? "로그인 요청에 실패했습니다."); return; }
    setUserId(data.user.id);
    setSessionNickname(data.user.nickname);
    setAuthPassword("");
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setUserId(""); setSessionNickname(""); setSchedules([]); setGroupSchedules([]); setGroups([]); resetCheckResult();
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

  if (!userId) return <main className="session-screen"><section className="session-card"><span className="brand-mark" aria-hidden="true">눈</span><p className="eyebrow">PRIVATE ACCOUNT</p><h1>내 일정으로<br />시작해 볼까요?</h1><div className="auth-tabs"><button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>로그인</button><button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>회원가입</button></div><form className="auth-form" onSubmit={(event) => void submitCredentials(event)}>{authMode === "signup" && <label>닉네임<input value={authNickname} onChange={(event) => setAuthNickname(event.target.value)} minLength={2} maxLength={20} autoComplete="nickname" required /></label>}<label>아이디<input value={authLoginId} onChange={(event) => setAuthLoginId(event.target.value.toLowerCase())} minLength={4} maxLength={24} pattern="[a-z0-9_]+" autoComplete="username" required /></label><label>비밀번호<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={authMode === "signup" ? 8 : 1} maxLength={72} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required /></label><button type="submit" disabled={authBusy}>{authBusy ? "처리 중…" : authMode === "signup" ? "가입하고 시작" : "로그인"}</button></form>{authMessage && <p className="form-message" role="status">{authMessage}</p>}<div className="auth-divider"><span>또는 개발용 데모 계정</span></div><div className="session-users">{users.map((user) => <button key={user.id} type="button" onClick={() => void login(user.id)}><strong>{user.nickname}</strong><span>바로 체험</span></button>)}</div>{message && <p className="form-message" role="status">{message}</p>}</section></main>;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="눈치맵 홈"><span className="brand-mark" aria-hidden="true">눈</span><span>눈치맵</span></a>
        <div className="header-copy">비공개 그룹 안에서 일정 위치를 공유하고 겹침 가능성을 확인해요</div>
        <div className="session-user"><span>{currentUser?.nickname}</span><button type="button" onClick={() => void logout()}>로그아웃</button></div>
      </header>
      <section className="hero" id="top">
        <div><p className="eyebrow">PRIVATE ROUTE PLANNER</p><h1>마주치고 싶지 않은 날,<br />조금 다르게 움직여요.</h1><p className="hero-description">다른 사람의 이름이나 정확한 일정을 보여주지 않고,<br />선택한 시간과 지역의 익명 겹침 가능성만 알려드립니다.</p></div>
        <aside className="privacy-note"><span className="privacy-icon" aria-hidden="true">✓</span><div><strong>비공개 그룹 공유</strong><p>같은 그룹에는 일정 위치를 표시하지만 사용자 이름은 공개하지 않아요.</p></div></aside>
      </section>
      <section className="workspace" aria-label="일정 확인 작업 영역">
        <MonthCalendar selectedDate={selectedDate} scheduleCount={schedules.length} onSelectDate={(date) => { setEditingScheduleId(null); setSelectedDate(date); resetCheckResult(); }} />
        <div className="map-stack">
          <MapView
            locationName={locationName}
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            conflictState={conflictState}
            schedules={mapSchedules}
            inputStartMinutes={toMinutes(startTime)}
            inputEndMinutes={toMinutes(endTime)}
            selectedDate={selectedDate}
          />
          <div className={`result-panel ${conflict?.hasConflict ? "has-conflict" : ""}`}>
            <p className="eyebrow">SCHEDULE CHECK</p>
            <h2>{conflict ? (conflict.ownScheduleConflict ? "내 일정과 시간이 겹쳐요" : conflict.hasConflict ? "그룹 일정과 겹칠 가능성이 있어요" : "현재 조건은 안전해요") : "일정을 입력하고 확인해 보세요"}</h2>
            {conflict?.ownScheduleConflict ? <><div className="risk-badge">내 일정 시간 충돌</div><p>같은 날짜에 이미 등록한 내 일정과 시간이 겹칩니다. 한 사람이 동시에 두 장소에 있을 수 없어 장소와 관계없이 등록할 수 없습니다.</p>{conflict.anonymousConflictCount > 0 && <p>같은 시간·지역에서 그룹 일정 {conflict.anonymousConflictCount}개와도 겹칠 가능성이 있습니다.</p>}{conflict.overlapWindow && <div className="overlap-time"><span>내 일정과 겹치는 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>시간을 변경하면 다시 등록할 수 있습니다.</small></> : conflict?.hasConflict ? <><div className="risk-badge">충돌 가능성 {conflict.riskLevel === "high" ? "높음" : "보통"}</div><p>이 시간대와 지역에서 그룹 일정 {conflict.anonymousConflictCount}개와 겹칠 가능성이 있습니다. 경고를 확인한 뒤에도 일정은 등록할 수 있습니다.</p>{conflict.overlapWindow && <div className="overlap-time"><span>충돌 가능 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>같은 그룹의 일정 위치는 지도에 표시되지만 사용자 이름은 숨겨집니다.</small></> : conflict ? <><div className="safe-mark">✓</div><p>내 일정 및 그룹 일정과 충돌하지 않습니다. 현재 조건으로 등록할 수 있습니다.</p></> : <p>내 일정은 시간 중복을, 그룹 일정은 날짜·시간·거리 조건을 계산합니다. 그룹 충돌은 경고로 표시되며 등록을 막지 않습니다.</p>}
            {conflict?.hasConflict && <button className="recommend-button" type="button" disabled={recommending || explainingRecommendation} onClick={() => void requestRecommendations()}>{recommending ? "안전 후보 계산 중…" : explainingRecommendation ? "후보 표시됨 · AI 설명 중…" : "안전한 대안 추천 받기"}</button>}
            {recommendation && <div className="recommendation-box"><div className="recommendation-heading"><strong>{recommendation.summary}</strong><span className={explainingRecommendation ? "is-loading" : ""}>{explainingRecommendation ? "Ollama 설명 준비 중…" : recommendation.explainedByAi ? "Ollama 설명" : "서버 계산 결과"}</span></div>{recommendation.candidates.length === 0 ? <p>날짜나 확인 반경을 바꾼 뒤 다시 시도해 주세요.</p> : <ul>{recommendation.candidates.map((candidate) => <li key={candidate.id}><div><strong>{candidate.title}</strong><p>{candidate.description}</p></div><button type="button" onClick={() => applyCandidate(candidate)}>적용</button></li>)}</ul>}</div>}
          </div>
        </div>
      </section>
      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className={`form-card ${editingScheduleId ? "is-editing" : ""}`} ref={formCardRef}>
          <p className="eyebrow">{editingScheduleId ? "EDIT SCHEDULE" : "DIRECT INPUT"}</p><h2 id="schedule-title">{editingScheduleId ? "일정 수정" : "직접 일정 등록"}</h2>
          <div className="schedule-form">
            <label>날짜<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); resetCheckResult(); }} /></label>
            <label>시작 시간<input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); resetCheckResult(); }} /></label>
            <label>종료 시간<input type="time" value={endTime} onChange={(event) => { setEndTime(event.target.value); resetCheckResult(); }} /></label>
            <LocationSearch selectedName={locationName} onSelect={selectLocation} />
            <div className="selected-location"><span>선택한 장소</span><strong>{locationName}</strong><small>{locationAddress}</small></div>
            <label>위도<input value={latitude} readOnly /></label><label>경도<input value={longitude} readOnly /></label>
            <label className="radius-field">확인 반경 <strong>{(radiusMeters / 1000).toFixed(1)}km</strong><input type="range" min="100" max="3000" step="100" value={radiusMeters} onChange={(event) => { setRadiusMeters(Number(event.target.value)); resetCheckResult(); }} /></label>
          </div>
          <label className="sharing-field"><input type="checkbox" checked={shareWithGroups} onChange={(event) => setShareWithGroups(event.target.checked)} /><span><strong>비공개 그룹에 공유</strong><small>공유를 끄면 이 일정은 나에게만 보입니다.</small></span><em>{shareWithGroups ? "그룹 공유" : "나만 보기"}</em></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <div className="form-actions">{editingScheduleId && <button className="cancel-button" type="button" disabled={busy} onClick={cancelEdit}>수정 취소</button>}<button className="secondary-button" type="button" disabled={busy || !userId || !locationResolved} onClick={() => void checkConflict()}>{busy ? "확인 중…" : "충돌 먼저 확인"}</button><button className="primary-button" type="button" disabled={busy || !userId || !locationResolved} onClick={() => void saveSchedule()}>{editingScheduleId ? "수정 저장" : "일정 등록"}</button></div>
        </div>
        <aside className="schedule-list">
          <div><p className="eyebrow">MY SCHEDULES</p><h2>{currentUser?.nickname ?? "사용자"}님의 일정</h2><p>{selectedDate}</p></div>
          {schedules.length === 0 ? <div className="empty-state">이 날짜에 등록한 일정이 없습니다.</div> : <ul>{schedules.map((schedule) => <li key={schedule.id} className={`${schedule.riskLevel !== "low" ? "has-risk" : ""} ${editingScheduleId === schedule.id ? "is-editing" : ""}`}><div className="schedule-summary"><strong>{formatMinutes(schedule.startMinutes)}–{formatMinutes(schedule.endMinutes)}</strong><span>{schedule.locationName} · 반경 {(schedule.radiusMeters / 1000).toFixed(1)}km</span><div className="schedule-badges"><small className={`sharing-state ${schedule.shareWithGroups ? "shared" : "private"}`}>{schedule.shareWithGroups ? "그룹 공유 중" : "나만 보기"}</small>{schedule.riskLevel !== "low" && <em>충돌 가능성 {schedule.riskLevel === "high" ? "높음" : "보통"}</em>}</div></div><div className="schedule-actions"><button className="edit-button" type="button" disabled={sharingScheduleId !== null || deletingScheduleId !== null} onClick={() => beginEdit(schedule)}>{editingScheduleId === schedule.id ? "수정 중" : "수정"}</button><button className="sharing-button" type="button" disabled={sharingScheduleId !== null || deletingScheduleId !== null} onClick={() => void toggleScheduleSharing(schedule)}>{sharingScheduleId === schedule.id ? "변경 중…" : schedule.shareWithGroups ? "나만 보기" : "그룹 공유"}</button><button className="delete-button" type="button" disabled={deletingScheduleId !== null || sharingScheduleId !== null} onClick={() => void deleteSchedule(schedule.id)} aria-label={`${schedule.locationName} 일정 삭제`}>{deletingScheduleId === schedule.id ? "삭제 중…" : "삭제"}</button></div></li>)}</ul>}
        </aside>
      </section>
      <section className="group-section" aria-labelledby="group-title">
        <div><p className="eyebrow">PRIVATE GROUPS</p><h2 id="group-title">충돌 확인 범위를 그룹으로 관리해요</h2><p>공유를 켠 일정의 위치와 시간만 같은 그룹 지도에 표시됩니다. 사용자 이름은 표시하지 않습니다.</p></div>
        <div className="group-tools">
          <div className="group-sharing-notice"><strong>그룹 공유 안내</strong><p>그룹을 만들거나 참여해도 기존의 `나만 보기` 일정은 공개되지 않습니다. 각 일정에서 언제든 공유를 바꿀 수 있어요.</p></div>
          <div className="group-form"><label>새 그룹 이름<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="예: 디자인팀 주말" /></label><button type="button" disabled={groupBusy} onClick={() => void createGroup()}>그룹 만들기</button></div>
          <div className="group-form"><label>초대 코드<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="예: NUNCHI" /></label><button type="button" disabled={groupBusy} onClick={() => void joinGroup()}>그룹 참여</button></div>
          {groupMessage && <p className="form-message" role="status">{groupMessage}</p>}
        </div>
        <div className="group-list">{groups.length === 0 ? <div className="empty-state">참여한 그룹이 없습니다. 그룹을 만들거나 초대 코드로 참여해 주세요.</div> : groups.map((group) => <article key={group.id}><div><strong>{group.name}</strong><span>익명 구성원 {group.memberCount}명</span></div><div><span>초대 코드</span><code>{group.inviteCode}</code></div></article>)}</div>
      </section>
      <section className="composer" aria-labelledby="composer-title">
        <div><p className="eyebrow">LOCAL OLLAMA</p><h2 id="composer-title">말하듯 입력해도 괜찮아요</h2><p>환경변수로 선택한 로컬 Ollama 모델이 문장을 구조화하고, 서버가 결과 형식을 다시 검증합니다.</p></div>
        <div className="ai-composer">
          <div className="input-shell"><textarea aria-label="자연어 일정" value={naturalText} onChange={(event) => { parsingRequestRef.current?.abort(); setDraftingSchedule(false); setAnalyzing(false); setNaturalText(event.target.value); }} rows={3} /><button type="button" disabled={draftingSchedule || analyzing} onClick={() => void analyzeNaturalLanguage()}>{draftingSchedule ? "초안 만드는 중…" : analyzing ? "초안 표시됨 · AI 확인 중…" : "AI로 분석"}</button></div>
          {assumptions.length > 0 && <div className="assumption-box"><strong>{analyzing ? "현재 빠른 초안" : "AI가 적용한 해석"}</strong><ul>{assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}
        </div>
      </section>
      <footer>눈치맵은 사람을 피하는 앱이 아니라, 서로의 개인 시간을 존중하는 익명 동선 조정 서비스입니다.</footer>
    </main>
  );
}
