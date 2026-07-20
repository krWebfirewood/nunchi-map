"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { NunchiPinIcon } from "@/components/brand/NunchiPinIcon";
import { LocationSearch, type SelectedLocation } from "@/components/map/LocationSearch";
import { MapView, type LiveMapLocation, type MapSchedule } from "@/components/map/MapView";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { DEMO_LOCATIONS } from "@/lib/locations";
import { searchKakaoPlaces } from "@/lib/kakao/maps";

type User = { id: string; nickname: string };
type Schedule = MapSchedule & { source: "own"; riskLevel: "low" | "medium" | "high"; shareWithGroups: boolean };
type Conflict = { hasConflict: boolean; ownScheduleConflict: boolean; anonymousConflictCount: number; overlapWindow: { startMinutes: number; endMinutes: number } | null; riskLevel: "low" | "medium" | "high" };
type ParsedSchedule = { date: string; startTime: string; endTime: string; locationName: string; radiusMeters: number; assumptions: string[] };
type RecommendationCandidate = { id: string; type: "location" | "time"; title: string; description: string; locationName: string; latitude: number; longitude: number; startMinutes: number; endMinutes: number; estimatedRisk: "low" };
type Recommendation = { summary: string; candidates: RecommendationCandidate[]; explainedByAi: boolean };
type Group = { id: string; name: string; inviteCode: string; memberCount: number; role: "owner" | "member" };
const aiFeatureEnabled = process.env.NEXT_PUBLIC_AI_FEATURE_ENABLED === "true";

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
  const [groupsLoadedFor, setGroupsLoadedFor] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupActionId, setGroupActionId] = useState<string | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [visibleLocationGroupId, setVisibleLocationGroupId] = useState<string | null>(null);
  const [sharingLocationGroupId, setSharingLocationGroupId] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<LiveMapLocation[]>([]);
  const [locationShareState, setLocationShareState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [locationShareMessage, setLocationShareMessage] = useState("");
  const locationWatchRef = useRef<number | null>(null);
  const locationHeartbeatRef = useRef<number | null>(null);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const sharingLocationGroupRef = useRef<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groupSchedules, setGroupSchedules] = useState<MapSchedule[]>([]);
  const [hasAnySchedule, setHasAnySchedule] = useState(false);
  const [schedulesLoadedFor, setSchedulesLoadedFor] = useState("");
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [scheduleLoadError, setScheduleLoadError] = useState(false);
  const scheduleRequestRef = useRef(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
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
  const groupNameRef = useRef<HTMLInputElement>(null);
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
  const onboardingReady = groupsLoadedFor === userId && schedulesLoadedFor === userId;

  const loadSchedules = useCallback(async () => {
    if (!userId) return;
    const requestId = ++scheduleRequestRef.current;
    setSchedulesLoading(true);
    setScheduleLoadError(false);
    try {
      const response = await fetch(`/api/schedules?date=${selectedDate}`);
      const data = await response.json();
      if (scheduleRequestRef.current !== requestId) return;
      setSchedules(response.ok ? data.schedules : []);
      setGroupSchedules(response.ok ? data.groupSchedules : []);
      setHasAnySchedule(response.ok && data.totalScheduleCount > 0);
      setScheduleLoadError(!response.ok);
      if (response.ok) setCalendarRefreshKey((value) => value + 1);
    } catch {
      if (scheduleRequestRef.current === requestId) setScheduleLoadError(true);
    } finally {
      if (scheduleRequestRef.current === requestId) setSchedulesLoading(false);
    }
  }, [selectedDate, userId]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/users").then((response) => response.json()) as Promise<{ users: User[] }>,
      fetch("/api/session").then((response) => response.json()) as Promise<{ user: User | null }>,
    ]).then(([userData, sessionData]) => {
      setUsers(userData.users);
      if (sessionData.user) setSchedulesLoading(true);
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
      .then(({ ok, data }) => { setGroups(ok ? data.groups : []); setGroupsLoadedFor(userId); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) { setGroups([]); setGroupsLoadedFor(userId); } });
    return () => controller.abort();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const requestId = ++scheduleRequestRef.current;
    void fetch(`/api/schedules?date=${selectedDate}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (controller.signal.aborted || scheduleRequestRef.current !== requestId) return;
        setSchedules(ok ? data.schedules : []);
        setGroupSchedules(ok ? data.groupSchedules : []);
        setHasAnySchedule(ok && data.totalScheduleCount > 0);
        setSchedulesLoadedFor(userId);
        setScheduleLoadError(!ok);
        setSchedulesLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (scheduleRequestRef.current !== requestId) return;
        setSchedules([]);
        setGroupSchedules([]);
        setHasAnySchedule(false);
        setSchedulesLoadedFor(userId);
        setScheduleLoadError(true);
        setSchedulesLoading(false);
      });
    return () => controller.abort();
  }, [selectedDate, userId]);

  const loadLiveLocations = useCallback(async (groupId: string) => {
    const response = await fetch(`/api/live-locations?groupId=${encodeURIComponent(groupId)}`);
    const data = await response.json().catch(() => null) as { locations?: LiveMapLocation[] } | null;
    if (response.ok) setLiveLocations(data?.locations ?? []);
  }, []);

  useEffect(() => {
    if (!userId || !visibleLocationGroupId) return;
    const initialId = window.setTimeout(() => void loadLiveLocations(visibleLocationGroupId), 0);
    const intervalId = window.setInterval(() => void loadLiveLocations(visibleLocationGroupId), 5_000);
    return () => { window.clearTimeout(initialId); window.clearInterval(intervalId); };
  }, [loadLiveLocations, userId, visibleLocationGroupId]);

  useEffect(() => {
    const stopOnExit = () => {
      if (locationWatchRef.current !== null) navigator.geolocation?.clearWatch(locationWatchRef.current);
      if (locationHeartbeatRef.current !== null) window.clearInterval(locationHeartbeatRef.current);
      const groupId = sharingLocationGroupRef.current;
      sharingLocationGroupRef.current = null;
      if (groupId) void fetch("/api/live-locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", stopOnExit);
    return () => { window.removeEventListener("pagehide", stopOnExit); stopOnExit(); };
  }, []);

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

  function selectDate(date: string) {
    if (date === selectedDate) return;
    setEditingScheduleId(null);
    setSchedulesLoading(true);
    setScheduleLoadError(false);
    setSelectedDate(date);
    resetCheckResult();
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
      if (!aiFeatureEnabled || data.candidates.length === 0) return;

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
    setSchedulesLoading(true);
    setScheduleLoadError(false);
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
    setSchedulesLoading(true);
    setScheduleLoadError(false);
    setUserId(data.user.id);
    setSessionNickname(data.user.nickname);
    setAuthPassword("");
  }

  async function logout() {
    await stopLocationSharing();
    await fetch("/api/session", { method: "DELETE" });
    setUserId(""); setSessionNickname(""); setSchedules([]); setGroupSchedules([]); setGroups([]); setHasAnySchedule(false); setGroupsLoadedFor(""); setSchedulesLoadedFor(""); setSchedulesLoading(false); setScheduleLoadError(false); resetCheckResult();
  }

  async function publishLiveLocation(groupId: string, position: GeolocationPosition) {
    latestPositionRef.current = position;
    const response = await fetch("/api/live-locations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
    });
    if (!response.ok) throw new Error("현재 위치를 그룹에 공유하지 못했습니다.");
    setSharingLocationGroupId(groupId);
    setLocationShareState("active");
    setLocationShareMessage("페이지를 열어 둔 동안만 현재 위치가 공유됩니다.");
    void loadLiveLocations(groupId);
  }

  async function startLocationSharing(group: Group) {
    if (!("geolocation" in navigator)) {
      setLocationShareState("error");
      setLocationShareMessage("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }
    if (sharingLocationGroupRef.current) await stopLocationSharing();
    setVisibleLocationGroupId(group.id);
    setSharingLocationGroupId(group.id);
    setLocationShareState("starting");
    setLocationShareMessage("위치 권한을 확인하고 있어요…");
    sharingLocationGroupRef.current = group.id;

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (sharingLocationGroupRef.current !== group.id) return;
        void publishLiveLocation(group.id, position).catch(() => {
          setLocationShareState("error");
          setLocationShareMessage("현재 위치 공유에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        });
      },
      (error) => {
        if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
        if (locationHeartbeatRef.current !== null) window.clearInterval(locationHeartbeatRef.current);
        locationWatchRef.current = null;
        locationHeartbeatRef.current = null;
        sharingLocationGroupRef.current = null;
        setSharingLocationGroupId(null);
        setLocationShareState("error");
        setLocationShareMessage(error.code === error.PERMISSION_DENIED ? "위치 권한이 필요합니다. 브라우저 설정에서 허용해 주세요." : "현재 위치를 확인하지 못했습니다.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    locationHeartbeatRef.current = window.setInterval(() => {
      const position = latestPositionRef.current;
      if (position && sharingLocationGroupRef.current === group.id) {
        void publishLiveLocation(group.id, position).catch(() => setLocationShareMessage("위치 갱신이 잠시 지연되고 있어요."));
      }
    }, 45_000);
  }

  async function stopLocationSharing() {
    const groupId = sharingLocationGroupRef.current;
    if (locationWatchRef.current !== null) navigator.geolocation?.clearWatch(locationWatchRef.current);
    if (locationHeartbeatRef.current !== null) window.clearInterval(locationHeartbeatRef.current);
    locationWatchRef.current = null;
    locationHeartbeatRef.current = null;
    latestPositionRef.current = null;
    sharingLocationGroupRef.current = null;
    setSharingLocationGroupId(null);
    setLocationShareState("idle");
    setLocationShareMessage(groupId ? "현재 위치 공유를 중지했습니다." : "");
    if (groupId) {
      await fetch("/api/live-locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      }).catch(() => undefined);
      if (visibleLocationGroupId === groupId) void loadLiveLocations(groupId);
    }
  }

  function focusScheduleSetup() {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusGroupSetup() {
    document.getElementById("groups")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => groupNameRef.current?.focus(), 350);
  }

  async function createGroup() {
    setGroupBusy(true); setGroupMessage("");
    const response = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName }) });
    const data = await response.json();
    setGroupBusy(false);
    if (!response.ok) { setGroupMessage(data.message ?? "그룹 생성에 실패했습니다."); return; }
    setGroupName(""); setGroupMessage(`‘${data.group.name}’ 그룹을 만들었습니다.`); await loadGroups(); setCalendarRefreshKey((value) => value + 1);
  }

  async function joinGroup() {
    setGroupBusy(true); setGroupMessage("");
    const response = await fetch("/api/groups/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode }) });
    const data = await response.json();
    setGroupBusy(false);
    if (!response.ok) { setGroupMessage(data.message ?? "그룹 참여에 실패했습니다."); return; }
    setInviteCode(""); setGroupMessage(`‘${data.group.name}’ 그룹에 참여했습니다.`); await loadGroups(); setCalendarRefreshKey((value) => value + 1);
  }

  async function copyInviteCode(group: Group) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      copied = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = group.inviteCode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    }
    if (!copied) { setGroupMessage(`초대 코드를 복사하지 못했습니다. ${group.inviteCode}를 직접 복사해 주세요.`); return; }
    setCopiedGroupId(group.id);
    setGroupMessage(`‘${group.name}’ 초대 코드를 복사했습니다.`);
    window.setTimeout(() => setCopiedGroupId((current) => current === group.id ? null : current), 1800);
  }

  async function runGroupAction(group: Group) {
    const isOwner = group.role === "owner";
    const confirmed = window.confirm(isOwner
      ? `‘${group.name}’ 그룹을 삭제할까요?\n그룹만 삭제되며 구성원 각자의 일정은 유지됩니다.`
      : `‘${group.name}’ 그룹에서 탈퇴할까요?\n이 그룹의 공유 일정은 더 이상 지도와 충돌 계산에 나타나지 않습니다.`);
    if (!confirmed) return;
    if (sharingLocationGroupId === group.id) await stopLocationSharing();
    setGroupActionId(group.id);
    setGroupMessage("");
    try {
      const endpoint = isOwner ? `/api/groups/${group.id}` : `/api/groups/${group.id}/leave`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) { setGroupMessage(data?.message ?? "그룹 변경에 실패했습니다."); return; }
      resetCheckResult();
      setGroupMessage(data?.message ?? (isOwner ? "그룹을 삭제했습니다." : "그룹에서 탈퇴했습니다."));
      if (visibleLocationGroupId === group.id) { setVisibleLocationGroupId(null); setLiveLocations([]); }
      await Promise.all([loadGroups(), loadSchedules()]);
    } catch {
      setGroupMessage("그룹 변경 요청에 실패했습니다.");
    } finally {
      setGroupActionId(null);
    }
  }

  if (!sessionReady) return <main className="session-screen"><div className="session-card"><p className="eyebrow">PRIVATE SESSION</p><h1>눈치맵을 준비하고 있어요</h1></div></main>;

  if (!userId) return <main className="session-screen"><section className="session-card"><span className="brand-mark login-brand-mark"><NunchiPinIcon mood="happy" /></span><p className="eyebrow">PRIVATE ACCOUNT</p><h1>내 일정으로<br />시작해 볼까요?</h1><div className="auth-tabs"><button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthMessage(""); }}>로그인</button><button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>회원가입</button></div><form className="auth-form" onSubmit={(event) => void submitCredentials(event)}>{authMode === "signup" && <label>닉네임<input value={authNickname} onChange={(event) => setAuthNickname(event.target.value)} minLength={2} maxLength={20} autoComplete="nickname" required /></label>}<label>아이디<input value={authLoginId} onChange={(event) => setAuthLoginId(event.target.value.toLowerCase())} minLength={4} maxLength={24} pattern="[a-z0-9_]+" autoComplete="username" required /></label><label>비밀번호<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={authMode === "signup" ? 8 : 1} maxLength={72} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required /></label><button type="submit" disabled={authBusy}>{authBusy ? "처리 중…" : authMode === "signup" ? "가입하고 시작" : "로그인"}</button></form>{authMessage && <p className="form-message" role="status">{authMessage}</p>}<div className="auth-divider"><span>또는 개발용 데모 계정</span></div><div className="session-users">{users.map((user) => <button key={user.id} type="button" onClick={() => void login(user.id)}><strong>{user.nickname}</strong><span>바로 체험</span></button>)}</div>{message && <p className="form-message" role="status">{message}</p>}</section></main>;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="눈치맵 홈"><span className="brand-mark"><NunchiPinIcon mood="happy" /></span><span>눈치맵</span></a>
        <div className="header-copy">비공개 그룹 안에서 일정 위치를 공유하고 겹침 가능성을 확인해요</div>
        <div className="session-user"><span>{currentUser?.nickname}</span><button type="button" onClick={() => void logout()}>로그아웃</button></div>
      </header>
      <nav className="mobile-nav" aria-label="빠른 이동">
        <a href="#map-area">지도</a>
        <a href="#schedule-title">등록</a>
        <a href="#groups">그룹</a>
      </nav>
      <section className="hero" id="top">
        <div><p className="eyebrow">PRIVATE ROUTE PLANNER</p><h1>마주치고 싶지 않은 날,<br />조금 다르게 움직여요.</h1><p className="hero-description">다른 사람의 이름이나 정확한 일정을 보여주지 않고,<br />선택한 시간과 지역의 익명 겹침 가능성만 알려드립니다.</p></div>
        <aside className="privacy-note"><span className="privacy-icon" aria-hidden="true">✓</span><div><strong>비공개 그룹 공유</strong><p>같은 그룹에는 일정 위치를 표시하지만 사용자 이름은 공개하지 않아요.</p></div></aside>
      </section>
      {onboardingReady && (groups.length === 0 || !hasAnySchedule) && <GettingStarted hasGroup={groups.length > 0} hasSchedule={hasAnySchedule} onGroupSetup={focusGroupSetup} onScheduleSetup={focusScheduleSetup} />}
      <section className="workspace" id="map-area" aria-label="일정 확인 작업 영역">
        <MonthCalendar key={`${userId}-${selectedDate.slice(0, 7)}`} selectedDate={selectedDate} scheduleCount={schedules.length} isScheduleLoading={schedulesLoading} refreshKey={calendarRefreshKey} onSelectDate={selectDate} />
        <div className="map-stack">
          <MapView
            locationName={locationName}
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            conflictState={conflictState}
            conflictRiskLevel={conflict?.riskLevel ?? null}
            schedules={mapSchedules}
            selectedDate={selectedDate}
            dataState={schedulesLoading ? "loading" : scheduleLoadError ? "error" : "ready"}
            liveLocations={visibleLocationGroupId ? liveLocations : []}
            liveLocationGroupId={visibleLocationGroupId}
            liveLocationGroupName={groups.find((group) => group.id === visibleLocationGroupId)?.name ?? null}
          />
          <div className={`result-panel ${conflict?.hasConflict ? "has-conflict" : ""}`} id="schedule-check">
            <p className="eyebrow">SCHEDULE CHECK</p>
            <h2>{conflict ? (conflict.ownScheduleConflict ? "내 일정과 시간이 겹쳐요" : conflict.hasConflict ? "그룹 일정과 겹칠 가능성이 있어요" : "현재 조건은 안전해요") : "일정을 입력하고 확인해 보세요"}</h2>
            {conflict?.ownScheduleConflict ? <><div className="risk-badge">내 일정 시간 중복 · 등록 가능</div><p>같은 날짜에 이미 등록한 내 일정과 시간이 겹칩니다. 의도한 중복 일정이라면 경고를 확인한 뒤 그대로 등록할 수 있습니다.</p>{conflict.anonymousConflictCount > 0 && <p>같은 시간·지역에서 그룹 일정 {conflict.anonymousConflictCount}개와도 겹칠 가능성이 있습니다.</p>}{conflict.overlapWindow && <div className="overlap-time"><span>내 일정과 겹치는 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>중복 등록이 아니라면 시간을 변경한 뒤 다시 확인해 주세요.</small></> : conflict?.hasConflict ? <><div className="risk-badge">충돌 가능성 {conflict.riskLevel === "high" ? "높음" : "보통"}</div><p>이 시간대와 지역에서 그룹 일정 {conflict.anonymousConflictCount}개와 겹칠 가능성이 있습니다. 경고를 확인한 뒤에도 일정은 등록할 수 있습니다.</p>{conflict.overlapWindow && <div className="overlap-time"><span>충돌 가능 시간</span><strong>{formatMinutes(conflict.overlapWindow.startMinutes)}–{formatMinutes(conflict.overlapWindow.endMinutes)}</strong></div>}<small>같은 그룹의 일정 위치는 지도에 표시되지만 사용자 이름은 숨겨집니다.</small></> : conflict ? <><div className="safe-mark">✓</div><p>내 일정 및 그룹 일정과 충돌하지 않습니다. 현재 조건으로 등록할 수 있습니다.</p></> : <p>내 일정과 그룹 일정의 시간·지역 중복을 계산합니다. 모든 충돌은 경고로 표시되며 일정 등록을 막지 않습니다.</p>}
            <div className="result-actions"><button className="map-check-button" type="button" disabled={busy || !userId || !locationResolved} onClick={() => void checkConflict()}>{busy ? "확인 중…" : conflict ? "현재 입력 다시 확인" : "현재 입력 충돌 확인"}</button>{conflict?.hasConflict && <button className="recommend-button" type="button" disabled={recommending || explainingRecommendation} onClick={() => void requestRecommendations()}>{recommending ? "안전 후보 계산 중…" : explainingRecommendation ? "후보 표시됨 · AI 설명 중…" : "안전한 대안 추천 받기"}</button>}</div>
            {recommendation && <div className="recommendation-box"><div className="recommendation-heading"><strong>{recommendation.summary}</strong><span className={explainingRecommendation ? "is-loading" : ""}>{explainingRecommendation ? "Ollama 설명 준비 중…" : recommendation.explainedByAi ? "Ollama 설명" : "서버 계산 결과"}</span></div>{recommendation.candidates.length === 0 ? <p>날짜나 확인 반경을 바꾼 뒤 다시 시도해 주세요.</p> : <ul>{recommendation.candidates.map((candidate) => <li key={candidate.id}><div><strong>{candidate.title}</strong><p>{candidate.description}</p></div><button type="button" onClick={() => applyCandidate(candidate)}>적용</button></li>)}</ul>}</div>}
          </div>
        </div>
      </section>
      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className={`form-card ${editingScheduleId ? "is-editing" : ""}`} ref={formCardRef}>
          <p className="eyebrow">{editingScheduleId ? "EDIT SCHEDULE" : "DIRECT INPUT"}</p><h2 id="schedule-title">{editingScheduleId ? "일정 수정" : "직접 일정 등록"}</h2>
          <div className="schedule-form">
            <label>날짜<input type="date" value={selectedDate} onChange={(event) => selectDate(event.target.value)} /></label>
            <label>시작 시간<input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); resetCheckResult(); }} /></label>
            <label>종료 시간<input type="time" value={endTime} onChange={(event) => { setEndTime(event.target.value); resetCheckResult(); }} /></label>
            <LocationSearch selectedName={locationName} onSelect={selectLocation} />
            <div className="selected-location"><span>선택한 장소</span><strong>{locationName}</strong><small>{locationAddress}</small></div>
            <label>위도<input value={latitude} readOnly /></label><label>경도<input value={longitude} readOnly /></label>
            <label className="radius-field">확인 반경 <strong>{(radiusMeters / 1000).toFixed(1)}km</strong><input type="range" min="100" max="3000" step="100" value={radiusMeters} onChange={(event) => { setRadiusMeters(Number(event.target.value)); resetCheckResult(); }} /></label>
          </div>
          <label className="sharing-field"><input type="checkbox" checked={shareWithGroups} onChange={(event) => setShareWithGroups(event.target.checked)} /><span><strong>비공개 그룹에 공유</strong><small>공유를 끄면 이 일정은 나에게만 보입니다.</small></span><em>{shareWithGroups ? "그룹 공유" : "나만 보기"}</em></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <div className="form-actions">{editingScheduleId && <button className="cancel-button" type="button" disabled={busy} onClick={cancelEdit}>수정 취소</button>}<a className="map-check-link" href="#schedule-check">충돌 확인은 지도 아래에서</a><button className="primary-button" type="button" disabled={busy || !userId || !locationResolved} onClick={() => void saveSchedule()}>{editingScheduleId ? "수정 저장" : "일정 등록"}</button></div>
        </div>
        <aside className="schedule-list">
          <div><p className="eyebrow">MY SCHEDULES</p><h2>{currentUser?.nickname ?? "사용자"}님의 일정</h2><p>{selectedDate}</p></div>
          {schedulesLoading ? <div className="schedule-loading" role="status" aria-live="polite"><i aria-hidden="true" /><strong>선택한 날짜의 일정을 불러오는 중…</strong><span>지도와 일정 목록을 함께 업데이트하고 있어요.</span></div> : scheduleLoadError ? <div className="empty-state empty-action"><strong>일정을 불러오지 못했어요.</strong><span>잠시 후 날짜를 다시 선택해 주세요.</span></div> : schedules.length === 0 ? <div className="empty-state empty-action"><strong>이 날짜에는 아직 일정이 없어요.</strong><span>직접 입력하거나 문장으로 일정을 추가해 보세요.</span><button type="button" onClick={focusScheduleSetup}>첫 일정 등록하기</button></div> : <ul>{schedules.map((schedule) => <li key={schedule.id} className={`${schedule.riskLevel !== "low" ? "has-risk" : ""} ${editingScheduleId === schedule.id ? "is-editing" : ""}`}><div className="schedule-summary"><strong>{formatMinutes(schedule.startMinutes)}–{formatMinutes(schedule.endMinutes)}</strong><span>{schedule.locationName} · 반경 {(schedule.radiusMeters / 1000).toFixed(1)}km</span><div className="schedule-badges"><small className={`sharing-state ${schedule.shareWithGroups ? "shared" : "private"}`}>{schedule.shareWithGroups ? "그룹 공유 중" : "나만 보기"}</small>{schedule.riskLevel !== "low" && <em>충돌 가능성 {schedule.riskLevel === "high" ? "높음" : "보통"}</em>}</div></div><div className="schedule-actions"><button className="edit-button" type="button" disabled={sharingScheduleId !== null || deletingScheduleId !== null} onClick={() => beginEdit(schedule)}>{editingScheduleId === schedule.id ? "수정 중" : "수정"}</button><button className="sharing-button" type="button" disabled={sharingScheduleId !== null || deletingScheduleId !== null} onClick={() => void toggleScheduleSharing(schedule)}>{sharingScheduleId === schedule.id ? "변경 중…" : schedule.shareWithGroups ? "나만 보기" : "그룹 공유"}</button><button className="delete-button" type="button" disabled={deletingScheduleId !== null || sharingScheduleId !== null} onClick={() => void deleteSchedule(schedule.id)} aria-label={`${schedule.locationName} 일정 삭제`}>{deletingScheduleId === schedule.id ? "삭제 중…" : "삭제"}</button></div></li>)}</ul>}
        </aside>
      </section>
      <section className="group-section" id="groups" aria-labelledby="group-title">
        <div><p className="eyebrow">PRIVATE GROUPS</p><h2 id="group-title">충돌 확인 범위를 그룹으로 관리해요</h2><p>공유를 켠 일정의 위치와 시간만 같은 그룹 지도에 표시됩니다. 사용자 이름은 표시하지 않습니다.</p></div>
        <div className="group-tools">
          <div className="group-sharing-notice"><strong>그룹 공유 안내</strong><p>그룹을 만들거나 참여해도 기존의 `나만 보기` 일정은 공개되지 않습니다. 각 일정에서 언제든 공유를 바꿀 수 있어요.</p></div>
          <div className="group-form"><label>새 그룹 이름<input ref={groupNameRef} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="예: 디자인팀 주말" /></label><button type="button" disabled={groupBusy} onClick={() => void createGroup()}>그룹 만들기</button></div>
          <div className="group-form"><label>초대 코드<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="예: NUNCHI" /></label><button type="button" disabled={groupBusy} onClick={() => void joinGroup()}>그룹 참여</button></div>
          {groupMessage && <p className="form-message" role="status">{groupMessage}</p>}
        </div>
        {locationShareMessage && <p className={`location-share-message ${locationShareState}`} role="status">{locationShareMessage}</p>}
        <div className="group-list">{groups.length === 0 ? <div className="empty-state empty-action"><strong>아직 연결된 그룹이 없어요.</strong><span>새 그룹을 만들거나 받은 초대 코드로 참여하세요.</span><button type="button" onClick={focusGroupSetup}>그룹 만들기</button></div> : groups.map((group) => <article key={group.id} className={`${group.role === "owner" ? "is-owner" : ""} ${visibleLocationGroupId === group.id ? "is-location-visible" : ""}`}>
          <div className="group-card-heading"><div><strong>{group.name}</strong><span>익명 구성원 {group.memberCount}명</span></div><em>{group.role === "owner" ? "내가 만든 그룹" : "참여한 그룹"}</em></div>
          <div className="group-invite"><span>초대 코드</span><div><code>{group.inviteCode}</code><button type="button" disabled={groupActionId !== null} onClick={() => void copyInviteCode(group)} aria-label={`${group.name} 초대 코드 복사`}>{copiedGroupId === group.id ? "복사됨" : "복사"}</button></div></div>
          <div className="live-location-actions"><button type="button" className={visibleLocationGroupId === group.id ? "active" : ""} onClick={() => setVisibleLocationGroupId(group.id)}>지도에서 보기</button>{sharingLocationGroupId === group.id ? <button type="button" className="stop-sharing" onClick={() => void stopLocationSharing()}>{locationShareState === "starting" ? "권한 확인 중…" : "위치 공유 중지"}</button> : <button type="button" className="start-sharing" onClick={() => void startLocationSharing(group)}>현재 위치 공유</button>}</div>
          <div className="group-card-actions"><small>{group.role === "owner" ? "생성자만 이 그룹을 삭제할 수 있습니다." : "탈퇴하면 이 그룹의 공유 일정이 보이지 않습니다."}</small><button type="button" className={group.role === "owner" ? "delete-group" : "leave-group"} disabled={groupActionId !== null || groupBusy} onClick={() => void runGroupAction(group)}>{groupActionId === group.id ? "처리 중…" : group.role === "owner" ? "그룹 삭제" : "그룹 탈퇴"}</button></div>
        </article>)}</div>
      </section>
      {aiFeatureEnabled && <section className="composer" aria-labelledby="composer-title">
        <div><p className="eyebrow">LOCAL OLLAMA</p><h2 id="composer-title">말하듯 입력해도 괜찮아요</h2><p>환경변수로 선택한 로컬 Ollama 모델이 문장을 구조화하고, 서버가 결과 형식을 다시 검증합니다.</p></div>
        <div className="ai-composer">
          <div className="input-shell"><textarea aria-label="자연어 일정" value={naturalText} onChange={(event) => { parsingRequestRef.current?.abort(); setDraftingSchedule(false); setAnalyzing(false); setNaturalText(event.target.value); }} rows={3} /><button type="button" disabled={draftingSchedule || analyzing} onClick={() => void analyzeNaturalLanguage()}>{draftingSchedule ? "초안 만드는 중…" : analyzing ? "초안 표시됨 · AI 확인 중…" : "AI로 분석"}</button></div>
          {assumptions.length > 0 && <div className="assumption-box"><strong>{analyzing ? "현재 빠른 초안" : "AI가 적용한 해석"}</strong><ul>{assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>}
        </div>
      </section>}
      <footer>눈치맵은 사람을 피하는 앱이 아니라, 서로의 개인 시간을 존중하는 익명 동선 조정 서비스입니다.</footer>
    </main>
  );
}
