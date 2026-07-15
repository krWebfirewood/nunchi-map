"use client";

import { useEffect, useRef, useState } from "react";

interface MapViewProps {
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  conflictState: "unchecked" | "safe" | "conflict";
}

interface KakaoLatLng {}
interface KakaoMap { setCenter(position: KakaoLatLng): void; relayout(): void }
interface KakaoOverlay { setMap(map: KakaoMap | null): void }
interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Marker: new (options: { map: KakaoMap; position: KakaoLatLng }) => KakaoOverlay;
  Circle: new (options: { map: KakaoMap; center: KakaoLatLng; radius: number; strokeWeight: number; strokeColor: string; strokeOpacity: number; fillColor: string; fillOpacity: number }) => KakaoOverlay;
}

declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

let kakaoLoader: Promise<KakaoMaps> | null = null;

function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao!.maps)));
  if (kakaoLoader) return kakaoLoader;
  kakaoLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao?.maps.load(() => resolve(window.kakao!.maps));
    script.onerror = () => reject(new Error("Kakao Maps SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return kakaoLoader;
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
