"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoOverlay } from "@/lib/kakao/maps";

interface MapViewProps {
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  conflictState: "unchecked" | "safe" | "conflict";
}

export function MapView({ locationName, latitude, longitude, radiusMeters, conflictState }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerRef = useRef<KakaoOverlay | null>(null);
  const circleRef = useRef<KakaoOverlay | null>(null);
  const [loadError, setLoadError] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";

  useEffect(() => {
    if (!appKey || !containerRef.current) return;
    let cancelled = false;
    void loadKakaoMaps(appKey).then((maps) => {
      if (cancelled || !containerRef.current) return;
      const center = new maps.LatLng(latitude, longitude);
      const map = mapRef.current ?? new maps.Map(containerRef.current, { center, level: 5 });
      mapRef.current = map;
      map.setCenter(center);
      map.relayout();
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      markerRef.current = new maps.Marker({ map, position: center });
      const isConflict = conflictState === "conflict";
      circleRef.current = new maps.Circle({
        map,
        center,
        radius: radiusMeters,
        strokeWeight: 2,
        strokeColor: isConflict ? "#b94f3b" : "#185f48",
        strokeOpacity: 0.9,
        fillColor: isConflict ? "#de765d" : "#73a98f",
        fillOpacity: conflictState === "unchecked" ? 0.13 : 0.28,
      });
      setLoadError(false);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [appKey, conflictState, latitude, longitude, radiusMeters]);

  if (!appKey || loadError) {
    const circleSize = Math.max(120, Math.min(270, 110 + radiusMeters / 12));
    return (
      <div className={`mock-map ${conflictState}`} aria-label={`${locationName} 지도 목업`}>
        <div className="mock-map-grid" aria-hidden="true" />
        <div className="mock-circle" style={{ width: circleSize, height: circleSize }} aria-hidden="true" />
        <div className="mock-marker" aria-hidden="true"><span /></div>
        <div className="map-place-label"><strong>{locationName}</strong><span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span></div>
        <div className="map-mode-badge">{loadError ? "Kakao 지도 연결 실패 · 목업 모드" : "지도 목업 모드"}</div>
        <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
      </div>
    );
  }

  return (
    <div className="kakao-map-shell">
      <div ref={containerRef} className="kakao-map" aria-label={`${locationName} Kakao 지도`} />
      <div className="map-mode-badge">Kakao 지도</div>
      <div className="map-radius-label">확인 반경 {(radiusMeters / 1000).toFixed(1)}km</div>
    </div>
  );
}
