"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoOverlay } from "@/lib/kakao/maps";

export interface MapSchedule {
  id: string;
  startMinutes: number;
  endMinutes: number;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface MapViewProps {
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  conflictState: "unchecked" | "safe" | "conflict";
  schedules: MapSchedule[];
  inputStartMinutes: number;
  inputEndMinutes: number;
  selectedDate: string;
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function overlapsInput(schedule: MapSchedule, startMinutes: number, endMinutes: number): boolean {
  return startMinutes < schedule.endMinutes && schedule.startMinutes < endMinutes;
}

function groupKey(schedule: MapSchedule): string {
  return `${schedule.latitude.toFixed(5)},${schedule.longitude.toFixed(5)}`;
}

export function MapView({
  locationName,
  latitude,
  longitude,
  radiusMeters,
  conflictState,
  schedules,
  inputStartMinutes,
  inputEndMinutes,
  selectedDate,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [viewPreference, setViewPreference] = useState<{ date: string; mode: "day" | "input" }>({ date: selectedDate, mode: "day" });
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";
  const viewMode = schedules.length === 0 ? "input" : viewPreference.date === selectedDate ? viewPreference.mode : "day";
  const activeScheduleCount = schedules.filter((schedule) => overlapsInput(schedule, inputStartMinutes, inputEndMinutes)).length;
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
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];

      if (viewMode === "day" && schedules.length > 0) {
        const bounds = new maps.LatLngBounds();
        const sortedSchedules = [...schedules].sort((a, b) => Number(overlapsInput(a, inputStartMinutes, inputEndMinutes)) - Number(overlapsInput(b, inputStartMinutes, inputEndMinutes)));
        for (const schedule of sortedSchedules) {
          const center = new maps.LatLng(schedule.latitude, schedule.longitude);
          const active = overlapsInput(schedule, inputStartMinutes, inputEndMinutes);
          overlaysRef.current.push(new maps.Circle({
            map,
            center,
            radius: schedule.radiusMeters,
            strokeWeight: active ? 3 : 2,
            strokeColor: active ? "#b94f3b" : "#526760",
            strokeOpacity: active ? 0.95 : 0.42,
            strokeStyle: active ? "solid" : "shortdash",
            fillColor: active ? "#de765d" : "#83968f",
            fillOpacity: active ? 0.28 : 0.08,
          }));
          const latitudeDelta = schedule.radiusMeters / 111_320;
          const longitudeDelta = schedule.radiusMeters / (111_320 * Math.max(0.2, Math.cos(schedule.latitude * Math.PI / 180)));
          bounds.extend(new maps.LatLng(schedule.latitude - latitudeDelta, schedule.longitude - longitudeDelta));
          bounds.extend(new maps.LatLng(schedule.latitude + latitudeDelta, schedule.longitude + longitudeDelta));
        }

        for (const group of groupedSchedules) {
          const representative = group[0];
          const groupActive = group.some((schedule) => overlapsInput(schedule, inputStartMinutes, inputEndMinutes));
          const label = document.createElement("div");
          label.className = `day-zone-label ${groupActive ? "active" : "inactive"}`;
          const place = document.createElement("strong");
          place.textContent = representative.locationName;
          const times = document.createElement("span");
          times.textContent = group.map((schedule) => `${formatMinutes(schedule.startMinutes)}–${formatMinutes(schedule.endMinutes)}`).join(" · ");
          label.append(place, times);
          overlaysRef.current.push(new maps.CustomOverlay({
            map,
            position: new maps.LatLng(representative.latitude, representative.longitude),
            content: label,
            yAnchor: 1,
            zIndex: groupActive ? 4 : 2,
          }));
        }
        map.setBounds(bounds, 66, 46, 46, 46);
      } else {
        map.setCenter(inputCenter);
        overlaysRef.current.push(new maps.Marker({ map, position: inputCenter }));
        const isConflict = conflictState === "conflict";
        overlaysRef.current.push(new maps.Circle({
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
      setLoadError(false);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [appKey, conflictState, groupedSchedules, inputEndMinutes, inputStartMinutes, latitude, longitude, radiusMeters, schedules, viewMode]);

  const mapControls = schedules.length > 0 && (
    <div className="map-view-controls" role="group" aria-label="지도 표시 방식">
      <button type="button" className={viewMode === "day" ? "active" : ""} onClick={() => setViewPreference({ date: selectedDate, mode: "day" })}>하루 일정 {schedules.length}</button>
      <button type="button" className={viewMode === "input" ? "active" : ""} onClick={() => setViewPreference({ date: selectedDate, mode: "input" })}>입력 위치</button>
    </div>
  );

  if (!appKey || loadError) {
    const circleSize = Math.max(120, Math.min(270, 110 + radiusMeters / 12));
    return (
      <div className={`mock-map ${conflictState}`} aria-label={`${locationName} 지도 목업`}>
        <div className="mock-map-grid" aria-hidden="true" />
        <div className="mock-circle" style={{ width: circleSize, height: circleSize }} aria-hidden="true" />
        <div className="mock-marker" aria-hidden="true"><span /></div>
        <div className="map-place-label"><strong>{locationName}</strong><span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span></div>
        {mapControls}
        <div className="map-mode-badge">{loadError ? "Kakao 지도 연결 실패 · 목업 모드" : "지도 목업 모드"}</div>
        <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
      </div>
    );
  }

  return (
    <div className="kakao-map-shell">
      <div ref={containerRef} className="kakao-map" aria-label={viewMode === "day" ? `선택한 날짜의 내 일정 ${schedules.length}개 지도` : `${locationName} Kakao 지도`} />
      {mapControls}
      <div className="map-mode-badge">Kakao 지도 · 내 일정만 표시</div>
      {viewMode === "day" ? (
        <div className="map-zone-legend"><span><i className="active" />입력 시간과 겹침 {activeScheduleCount}</span><span><i />다른 시간 {schedules.length - activeScheduleCount}</span></div>
      ) : (
        <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
      )}
    </div>
  );
}
