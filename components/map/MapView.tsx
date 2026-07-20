"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoOverlay } from "@/lib/kakao/maps";
import { isScheduleActiveAtTime, summarizeSchedulesAtTime } from "@/lib/map/timeExplorer";

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
  liveLocations: LiveMapLocation[];
  liveLocationGroupId: string | null;
  liveLocationGroupName: string | null;
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function groupKey(schedule: MapSchedule): string {
  return `${schedule.source}:${schedule.latitude.toFixed(5)},${schedule.longitude.toFixed(5)}`;
}

function isExplorerScheduleActive(schedule: MapSchedule, mode: "all" | "time", minutes: number): boolean {
  return mode === "all" || isScheduleActiveAtTime(schedule, minutes);
}

export function shouldFitLiveLocations(previousGroupId: string | null, currentGroupId: string | null, locationCount: number): boolean {
  return currentGroupId !== null && previousGroupId !== currentGroupId && locationCount > 0;
}

export function MapView({
  locationName,
  latitude,
  longitude,
  radiusMeters,
  conflictState,
  schedules,
  selectedDate,
  liveLocations,
  liveLocationGroupId,
  liveLocationGroupName,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const scheduleOverlaysRef = useRef<KakaoOverlay[]>([]);
  const liveOverlaysRef = useRef<KakaoOverlay[]>([]);
  const scheduleCameraKeyRef = useRef<string | null>(null);
  const liveCameraGroupRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewPreference, setViewPreference] = useState<{ date: string; mode: "day" | "input" }>({ date: selectedDate, mode: "day" });
  const [timePreference, setTimePreference] = useState<{ date: string; mode: "all" | "time"; minutes: number }>({ date: selectedDate, mode: "all", minutes: 720 });
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";
  const viewMode = schedules.length === 0 ? "input" : viewPreference.date === selectedDate ? viewPreference.mode : "day";
  const timeMode = timePreference.date === selectedDate ? timePreference.mode : "all";
  const explorerMinutes = timePreference.date === selectedDate ? timePreference.minutes : 720;
  const timeSummary = summarizeSchedulesAtTime(schedules, explorerMinutes);
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
        const sortedSchedules = [...schedules].sort((a, b) => Number(isExplorerScheduleActive(a, timeMode, explorerMinutes)) - Number(isExplorerScheduleActive(b, timeMode, explorerMinutes)));
        for (const schedule of sortedSchedules) {
          const center = new maps.LatLng(schedule.latitude, schedule.longitude);
          const active = isExplorerScheduleActive(schedule, timeMode, explorerMinutes);
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
          const groupActive = group.some((schedule) => isExplorerScheduleActive(schedule, timeMode, explorerMinutes));
          const label = document.createElement("div");
          label.className = `day-zone-label ${representative.source} ${groupActive ? "active" : "inactive"}`;
          const place = document.createElement("strong");
          const sourceLabel = representative.source === "group" ? "그룹" : representative.shareWithGroups === false ? "내 일정 · 나만 보기" : "내 일정";
          place.textContent = `${sourceLabel} · ${representative.locationName}`;
          const times = document.createElement("span");
          times.textContent = group.map((schedule) => `${formatMinutes(schedule.startMinutes)}–${formatMinutes(schedule.endMinutes)}`).join(" · ");
          label.append(place, times);
          scheduleOverlaysRef.current.push(new maps.CustomOverlay({
            map,
            position: new maps.LatLng(representative.latitude, representative.longitude),
            content: label,
            yAnchor: 1,
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
        scheduleOverlaysRef.current.push(new maps.Marker({ map, position: inputCenter }));
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
  }, [appKey, conflictState, explorerMinutes, groupedSchedules, latitude, longitude, mapReady, radiusMeters, schedules, selectedDate, timeMode, viewMode]);

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
        return;
      }

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
        if (shouldFitLiveLocations(liveCameraGroupRef.current, liveLocationGroupId, liveLocations.length)) {
          map.setBounds(liveBounds, 80, 54, 90, 54);
          liveCameraGroupRef.current = liveLocationGroupId;
        }
      }
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
  const sliderStyle = { "--time-progress": `${(explorerMinutes / 1440) * 100}%` } as CSSProperties;
  const timeExplorer = showTimeExplorer && (
    <section className="map-time-explorer" aria-label="지도 시간대 탐색">
      <div className="time-explorer-heading">
        <div className="time-explorer-title"><span>MAP TIME</span><strong>{timeMode === "all" ? "하루 전체" : formatMinutes(explorerMinutes)}</strong><small>{timeMode === "all" ? "슬라이더를 움직여 시간 선택" : "30분 단위 탐색"}</small></div>
        <div className="time-mode-buttons" role="group" aria-label="시간 표시 범위">
          <button type="button" className={timeMode === "all" ? "active" : ""} aria-pressed={timeMode === "all"} onClick={() => setTimePreference({ date: selectedDate, mode: "all", minutes: explorerMinutes })}>하루 전체</button>
          <button type="button" className={timeMode === "time" ? "active" : ""} aria-pressed={timeMode === "time"} onClick={() => setTimePreference({ date: selectedDate, mode: "time", minutes: explorerMinutes })}>시간 선택</button>
        </div>
      </div>
      <div className="time-slider-shell">
        <input type="range" min="0" max="1440" step="30" value={explorerMinutes} style={sliderStyle} onChange={(event) => setTimePreference({ date: selectedDate, mode: "time", minutes: Number(event.target.value) })} aria-label="지도에서 확인할 시간" aria-valuetext={formatMinutes(explorerMinutes)} />
        <div className="time-scale" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      </div>
      <div className={`time-risk-summary ${timeMode === "all" ? "all" : timeSummary.riskLevel}`} role="status" aria-live="polite">
        <strong>{timeMode === "all" ? `하루 일정 ${schedules.length}개` : timeStatusLabel}</strong>
        <span>{timeMode === "all" ? "모든 시간대의 영역을 진하게 표시합니다." : `활성 ${timeSummary.activeCount}개 · 내 일정 ${timeSummary.ownCount}개 · 그룹 일정 ${timeSummary.groupCount}개`}</span>
      </div>
    </section>
  );

  if (!appKey || loadError) {
    const circleSize = Math.max(120, Math.min(270, 110 + radiusMeters / 12));
    return <div className={`map-panel ${showTimeExplorer ? "has-time-explorer" : ""}`}>
      <div className={`mock-map ${conflictState}`} aria-label={`${locationName} 지도 목업`}>
          <div className="mock-map-grid" aria-hidden="true" />
          <div className="mock-circle" style={{ width: circleSize, height: circleSize }} aria-hidden="true" />
          <div className="mock-marker" aria-hidden="true"><span /></div>
          <div className="map-place-label"><strong>{locationName}</strong><span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span></div>
          {mapControls}
          <div className="map-mode-badge">{loadError ? "Kakao 지도 연결 실패 · 목업 모드" : "지도 목업 모드"}</div>
          {liveLocationGroupName && <div className="live-location-summary">{liveLocationGroupName} · 현재 위치 {liveLocations.length}명</div>}
          <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
        </div>
        {timeExplorer}
      </div>;
  }

  return <div className={`map-panel ${showTimeExplorer ? "has-time-explorer" : ""}`}>
      <div className="kakao-map-shell">
        <div ref={containerRef} className="kakao-map" aria-label={viewMode === "day" ? `선택한 날짜의 일정 ${schedules.length}개 지도` : `${locationName} Kakao 지도`} />
        {mapControls}
        <div className="map-mode-badge">Kakao 지도 · 비공개 그룹 공유</div>
        {liveLocationGroupName && <div className="live-location-summary">{liveLocationGroupName} · 현재 위치 {liveLocations.length}명</div>}
        {viewMode === "day" ? (
          <div className="map-zone-legend"><span><i className="own" />내 일정 {schedules.filter((schedule) => schedule.source === "own").length}</span><span><i className="group" />그룹 일정 {schedules.filter((schedule) => schedule.source === "group").length}</span><small>{timeMode === "all" ? "진한 원: 하루 전체" : `${formatMinutes(explorerMinutes)} 활성 영역 ${activeScheduleCount}개`}</small></div>
        ) : (
          <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
        )}
      </div>
      {timeExplorer}
    </div>;
}
