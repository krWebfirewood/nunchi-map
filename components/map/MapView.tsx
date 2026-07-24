"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoOverlay } from "@/lib/kakao/maps";
import { isScheduleActiveInRange, summarizeSchedulesInRange } from "@/lib/map/timeExplorer";

export interface MapSchedule {
  id: string;
  startMinutes: number;
  endMinutes: number;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  source: "own" | "group";
  shareWithGroups?: boolean;
}

export interface LiveMapLocation {
  userId: string;
  nickname: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  updatedAt: string;
  isMe: boolean;
}

interface MapViewProps {
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  conflictState: "unchecked" | "safe" | "conflict";
  schedules: MapSchedule[];
  selectedDate: string;
  dataState: "loading" | "error" | "ready";
  liveLocations: LiveMapLocation[];
  liveLocationGroupId: string | null;
  liveLocationGroupName: string | null;
  liveLocationSyncState: "idle" | "loading" | "ready" | "error";
  liveLocationsUpdatedAt: number | null;
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function groupKey(schedule: MapSchedule): string {
  return `${schedule.source}:${schedule.latitude.toFixed(5)},${schedule.longitude.toFixed(5)}`;
}

function isExplorerScheduleActive(schedule: MapSchedule, mode: "all" | "time", startMinutes: number, endMinutes: number): boolean {
  return mode === "all" || isScheduleActiveInRange(schedule, startMinutes, endMinutes);
}

export function shouldFitLiveLocations(
  previousGroupId: string | null,
  currentGroupId: string | null,
  previousUserIds: string[],
  currentUserIds: string[],
): boolean {
  if (!currentGroupId || currentUserIds.length === 0) return false;
  if (previousGroupId !== currentGroupId) return true;
  return currentUserIds.some((userId) => !previousUserIds.includes(userId));
}

export function MapView({
  locationName,
  latitude,
  longitude,
  radiusMeters,
  conflictState,
  schedules,
  selectedDate,
  dataState,
  liveLocations,
  liveLocationGroupId,
  liveLocationGroupName,
  liveLocationSyncState,
  liveLocationsUpdatedAt,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const scheduleOverlaysRef = useRef<KakaoOverlay[]>([]);
  const liveOverlaysRef = useRef<KakaoOverlay[]>([]);
  const scheduleCameraKeyRef = useRef<string | null>(null);
  const liveCameraGroupRef = useRef<string | null>(null);
  const liveLocationUserIdsRef = useRef<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewPreference, setViewPreference] = useState<{ date: string; mode: "day" | "input" }>({ date: selectedDate, mode: "day" });
  const [timePreference, setTimePreference] = useState<{ date: string; mode: "all" | "time"; startMinutes: number; endMinutes: number }>({ date: selectedDate, mode: "all", startMinutes: 540, endMinutes: 1080 });
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";
  const viewMode = schedules.length === 0 ? "input" : viewPreference.date === selectedDate ? viewPreference.mode : "day";
  const timeMode = timePreference.date === selectedDate ? timePreference.mode : "all";
  const explorerStartMinutes = timePreference.date === selectedDate ? timePreference.startMinutes : 540;
  const explorerEndMinutes = timePreference.date === selectedDate ? timePreference.endMinutes : 1080;
  const timeSummary = summarizeSchedulesInRange(schedules, explorerStartMinutes, explorerEndMinutes);
  const activeScheduleCount = timeMode === "all" ? schedules.length : timeSummary.activeCount;
  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, MapSchedule[]>();
    for (const schedule of schedules) {
      const key = groupKey(schedule);
      groups.set(key, [...(groups.get(key) ?? []), schedule]);
    }
    return [...groups.values()];
  }, [schedules]);

  useEffect(() => {
    if (!appKey || !containerRef.current) return;
    let cancelled = false;
    void loadKakaoMaps(appKey).then((maps) => {
      if (cancelled || !containerRef.current) return;
      const inputCenter = new maps.LatLng(latitude, longitude);
      const map = mapRef.current ?? new maps.Map(containerRef.current, { center: inputCenter, level: 5 });
      mapRef.current = map;
      map.relayout();
      setLoadError(false);
      setMapReady(true);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [appKey, latitude, longitude]);

  useEffect(() => {
    if (!appKey || !mapReady || !mapRef.current) return;
    let cancelled = false;
    void loadKakaoMaps(appKey).then((maps) => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;
      const inputCenter = new maps.LatLng(latitude, longitude);
      scheduleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      scheduleOverlaysRef.current = [];

      if (viewMode === "day" && schedules.length > 0) {
        const bounds = new maps.LatLngBounds();
        const sortedSchedules = [...schedules].sort((a, b) => Number(isExplorerScheduleActive(a, timeMode, explorerStartMinutes, explorerEndMinutes)) - Number(isExplorerScheduleActive(b, timeMode, explorerStartMinutes, explorerEndMinutes)));
        for (const schedule of sortedSchedules) {
          const center = new maps.LatLng(schedule.latitude, schedule.longitude);
          const active = isExplorerScheduleActive(schedule, timeMode, explorerStartMinutes, explorerEndMinutes);
          const isGroupSchedule = schedule.source === "group";
          scheduleOverlaysRef.current.push(new maps.Circle({
            map,
            center,
            radius: schedule.radiusMeters,
            strokeWeight: active ? 3 : 2,
            strokeColor: isGroupSchedule ? "#b94f3b" : "#185f48",
            strokeOpacity: active ? 0.95 : 0.42,
            strokeStyle: active ? "solid" : "shortdash",
            fillColor: isGroupSchedule ? "#de765d" : "#73a98f",
            fillOpacity: active ? 0.28 : 0.07,
          }));
          const latitudeDelta = schedule.radiusMeters / 111_320;
          const longitudeDelta = schedule.radiusMeters / (111_320 * Math.max(0.2, Math.cos(schedule.latitude * Math.PI / 180)));
          bounds.extend(new maps.LatLng(schedule.latitude - latitudeDelta, schedule.longitude - longitudeDelta));
          bounds.extend(new maps.LatLng(schedule.latitude + latitudeDelta, schedule.longitude + longitudeDelta));
        }

        for (const group of groupedSchedules) {
          const representative = group[0];
          const groupActive = group.some((schedule) => isExplorerScheduleActive(schedule, timeMode, explorerStartMinutes, explorerEndMinutes));
          const label = document.createElement("div");
          label.className = `day-zone-label ${representative.source} ${groupActive ? "active" : "inactive"}`;
          const copy = document.createElement("div");
          copy.className = "day-zone-copy";
          const place = document.createElement("strong");
          const sourceLabel = representative.source === "group" ? "그룹" : representative.shareWithGroups === false ? "내 일정 · 나만 보기" : "내 일정";
          place.textContent = `${sourceLabel} · ${representative.locationName}`;
          const times = document.createElement("span");
          times.textContent = group.map((schedule) => `${formatMinutes(schedule.startMinutes)}–${formatMinutes(schedule.endMinutes)}`).join(" · ");
          copy.append(place, times);
          label.append(copy);
          scheduleOverlaysRef.current.push(new maps.CustomOverlay({
            map,
            position: new maps.LatLng(representative.latitude, representative.longitude),
            content: label,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: groupActive ? 4 : 2,
          }));
        }
        const scheduleCameraKey = `day:${selectedDate}:${schedules.map((schedule) => `${schedule.id}:${schedule.latitude}:${schedule.longitude}:${schedule.radiusMeters}`).join("|")}`;
        if (scheduleCameraKeyRef.current !== scheduleCameraKey) {
          map.setBounds(bounds, 66, 46, 46, 46);
          scheduleCameraKeyRef.current = scheduleCameraKey;
        }
      } else {
        const inputCameraKey = `input:${latitude}:${longitude}`;
        if (scheduleCameraKeyRef.current !== inputCameraKey) {
          map.setCenter(inputCenter);
          scheduleCameraKeyRef.current = inputCameraKey;
        }
        const isConflict = conflictState === "conflict";
        scheduleOverlaysRef.current.push(new maps.Circle({
          map,
          center: inputCenter,
          radius: radiusMeters,
          strokeWeight: 2,
          strokeColor: isConflict ? "#b94f3b" : "#185f48",
          strokeOpacity: 0.9,
          fillColor: isConflict ? "#de765d" : "#73a98f",
          fillOpacity: conflictState === "unchecked" ? 0.13 : 0.28,
        }));
      }

    });
    return () => { cancelled = true; };
  }, [appKey, conflictState, explorerEndMinutes, explorerStartMinutes, groupedSchedules, latitude, longitude, mapReady, radiusMeters, schedules, selectedDate, timeMode, viewMode]);

  useEffect(() => {
    if (!appKey || !mapReady || !mapRef.current) return;
    let cancelled = false;
    void loadKakaoMaps(appKey).then((maps) => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;
      liveOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      liveOverlaysRef.current = [];

      if (!liveLocationGroupId) {
        liveCameraGroupRef.current = null;
        liveLocationUserIdsRef.current = [];
        return;
      }

      const currentUserIds = liveLocations.map((location) => location.userId);
      if (liveLocations.length > 0) {
        const liveBounds = new maps.LatLngBounds();
        for (const location of liveLocations) {
          const position = new maps.LatLng(location.latitude, location.longitude);
          liveBounds.extend(position);
          liveOverlaysRef.current.push(new maps.Circle({
            map,
            center: position,
            radius: Math.max(10, Math.min(200, location.accuracyMeters)),
            strokeWeight: 2,
            strokeColor: location.isMe ? "#176247" : "#2f5d9b",
            strokeOpacity: 0.85,
            fillColor: location.isMe ? "#74b597" : "#80a9df",
            fillOpacity: 0.22,
          }));
          const label = document.createElement("div");
          label.className = `live-location-label ${location.isMe ? "me" : "member"}`;
          const dot = document.createElement("i");
          const name = document.createElement("strong");
          name.textContent = location.isMe ? `${location.nickname} · 나` : location.nickname;
          const accuracy = document.createElement("span");
          accuracy.textContent = `정확도 약 ${Math.max(1, Math.round(location.accuracyMeters))}m`;
          label.append(dot, name, accuracy);
          liveOverlaysRef.current.push(new maps.CustomOverlay({ map, position, content: label, yAnchor: 1.35, zIndex: 10 }));
        }
        if (shouldFitLiveLocations(liveCameraGroupRef.current, liveLocationGroupId, liveLocationUserIdsRef.current, currentUserIds)) {
          map.setBounds(liveBounds, 80, 54, 90, 54);
        }
      }
      liveCameraGroupRef.current = liveLocationGroupId;
      liveLocationUserIdsRef.current = currentUserIds;
    });
    return () => { cancelled = true; };
  }, [appKey, liveLocationGroupId, liveLocations, mapReady]);

  useEffect(() => () => {
    scheduleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    liveOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
  }, []);

  const mapControls = schedules.length > 0 && (
    <div className="map-view-controls" role="group" aria-label="지도 표시 방식">
      <button type="button" className={viewMode === "day" ? "active" : ""} onClick={() => setViewPreference({ date: selectedDate, mode: "day" })}>하루 일정 {schedules.length}</button>
      <button type="button" className={viewMode === "input" ? "active" : ""} onClick={() => setViewPreference({ date: selectedDate, mode: "input" })}>입력 위치</button>
    </div>
  );

  const timeStatusLabel = timeSummary.riskLevel === "high"
    ? "충돌 가능성 높음"
    : timeSummary.riskLevel === "medium"
      ? "충돌 주의"
      : timeSummary.activeCount === 0
        ? "활성 일정 없음"
        : "내 일정과 그룹 일정 겹침 없음";
  const showTimeExplorer = schedules.length > 0 && viewMode === "day";
  const sliderStyle = {
    "--time-start": `${(explorerStartMinutes / 1440) * 100}%`,
    "--time-end": `${(explorerEndMinutes / 1440) * 100}%`,
  } as CSSProperties;
  const timeExplorer = showTimeExplorer && (
    <section className="map-time-explorer" aria-label="지도 시간대 탐색">
      <div className="time-explorer-heading">
        <div className="time-explorer-title"><span>MAP TIME</span><strong>{timeMode === "all" ? "하루 전체" : `${formatMinutes(explorerStartMinutes)}–${formatMinutes(explorerEndMinutes)}`}</strong><small>{timeMode === "all" ? "시작과 종료 시간을 움직여 범위 선택" : "30분 단위 시간 범위"}</small></div>
        <div className="time-mode-buttons" role="group" aria-label="시간 표시 범위">
          <button type="button" className={timeMode === "all" ? "active" : ""} aria-pressed={timeMode === "all"} onClick={() => setTimePreference({ date: selectedDate, mode: "all", startMinutes: explorerStartMinutes, endMinutes: explorerEndMinutes })}>하루 전체</button>
          <button type="button" className={timeMode === "time" ? "active" : ""} aria-pressed={timeMode === "time"} onClick={() => setTimePreference({ date: selectedDate, mode: "time", startMinutes: explorerStartMinutes, endMinutes: explorerEndMinutes })}>시간 범위</button>
        </div>
      </div>
      <div className="time-range-values" aria-live="polite">
        <div><span>시작 시간</span><strong>{formatMinutes(explorerStartMinutes)}</strong></div>
        <i aria-hidden="true" />
        <div><span>종료 시간</span><strong>{formatMinutes(explorerEndMinutes)}</strong></div>
      </div>
      <div className="time-slider-shell time-range-slider" style={sliderStyle}>
        <div className="time-range-track" aria-hidden="true" />
        <input className="range-start" type="range" min="0" max="1440" step="30" value={explorerStartMinutes} onChange={(event) => setTimePreference({ date: selectedDate, mode: "time", startMinutes: Math.min(Number(event.target.value), explorerEndMinutes - 30), endMinutes: explorerEndMinutes })} aria-label="지도에서 확인할 시작 시간" aria-valuetext={formatMinutes(explorerStartMinutes)} />
        <input className="range-end" type="range" min="0" max="1440" step="30" value={explorerEndMinutes} onChange={(event) => setTimePreference({ date: selectedDate, mode: "time", startMinutes: explorerStartMinutes, endMinutes: Math.max(Number(event.target.value), explorerStartMinutes + 30) })} aria-label="지도에서 확인할 종료 시간" aria-valuetext={formatMinutes(explorerEndMinutes)} />
        <div className="time-scale" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      </div>
      <div className={`time-risk-summary ${timeMode === "all" ? "all" : timeSummary.riskLevel}`} role="status" aria-live="polite">
        <strong>{timeMode === "all" ? `하루 일정 ${schedules.length}개` : timeStatusLabel}</strong>
        <span>{timeMode === "all" ? "모든 시간대의 영역을 진하게 표시합니다." : `${formatMinutes(explorerStartMinutes)}–${formatMinutes(explorerEndMinutes)} · 활성 ${timeSummary.activeCount}개 · 내 일정 ${timeSummary.ownCount}개 · 그룹 일정 ${timeSummary.groupCount}개`}</span>
      </div>
    </section>
  );
  const [, selectedMonth, selectedDay] = selectedDate.split("-").map(Number);
  const liveLocationSyncCopy = liveLocationSyncState === "loading"
    ? "처음 불러오는 중…"
    : liveLocationSyncState === "error"
      ? "갱신 실패 · 자동 재시도 중"
      : liveLocationsUpdatedAt
        ? `${new Date(liveLocationsUpdatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} 갱신`
        : "위치 보기를 준비하고 있어요";
  const liveLocationSummary = liveLocationGroupName && (
    <div className={`live-location-summary ${liveLocationSyncState}`} role="status" aria-live="polite">
      <strong>{liveLocationGroupName} · 현재 위치 {liveLocations.length}명</strong>
      <span>{liveLocationSyncCopy} · 5초마다 확인</span>
    </div>
  );
  const dataFeedback = dataState !== "ready" && (
    <div className={`map-data-state ${dataState}`} role={dataState === "error" ? "alert" : "status"} aria-live="polite">
      <i aria-hidden="true" />
      <div><strong>{selectedMonth}월 {selectedDay}일 일정</strong><span>{dataState === "loading" ? "지도와 일정 정보를 불러오는 중…" : "일정을 불러오지 못했어요. 날짜를 다시 선택해 주세요."}</span></div>
    </div>
  );

  if (!appKey || loadError) {
    const circleSize = Math.max(120, Math.min(270, 110 + radiusMeters / 12));
    return <div className={`map-panel ${showTimeExplorer ? "has-time-explorer" : ""} ${dataState !== "ready" ? "is-data-pending" : ""}`} aria-busy={dataState === "loading"}>
      <div className={`mock-map ${conflictState}`} aria-label={`${locationName} 지도 목업`}>
          <div className="mock-map-grid" aria-hidden="true" />
          <div className="mock-circle" style={{ width: circleSize, height: circleSize }} aria-hidden="true" />
          <div className="map-place-label"><strong>{locationName}</strong><span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span></div>
          {mapControls}
          <div className="map-mode-badge">{loadError ? "Kakao 지도 연결 실패 · 목업 모드" : "지도 목업 모드"}</div>
          {liveLocationSummary}
          <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
        </div>
        {timeExplorer}
        {dataFeedback}
      </div>;
  }

  return <div className={`map-panel ${showTimeExplorer ? "has-time-explorer" : ""} ${dataState !== "ready" ? "is-data-pending" : ""}`} aria-busy={dataState === "loading"}>
      <div className="kakao-map-shell">
        <div ref={containerRef} className="kakao-map" aria-label={viewMode === "day" ? `선택한 날짜의 일정 ${schedules.length}개 지도` : `${locationName} Kakao 지도`} />
        {mapControls}
        <div className="map-mode-badge">Kakao 지도 · 비공개 그룹 공유</div>
        {liveLocationSummary}
        {viewMode === "day" ? (
          <div className="map-zone-legend"><span><i className="own" />내 일정 {schedules.filter((schedule) => schedule.source === "own").length}</span><span><i className="group" />그룹 일정 {schedules.filter((schedule) => schedule.source === "group").length}</span><small>{timeMode === "all" ? "진한 원: 하루 전체" : `${formatMinutes(explorerStartMinutes)}–${formatMinutes(explorerEndMinutes)} 활성 영역 ${activeScheduleCount}개`}</small></div>
        ) : (
          <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
        )}
      </div>
      {timeExplorer}
      {dataFeedback}
    </div>;
}
