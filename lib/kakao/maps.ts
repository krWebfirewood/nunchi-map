export type KakaoLatLng = object;

export interface KakaoMap {
  setCenter(position: KakaoLatLng): void;
  relayout(): void;
}

export interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
}

export interface KakaoPlaceResult {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

interface KakaoPlacesService {
  keywordSearch(
    keyword: string,
    callback: (results: KakaoPlaceResult[], status: string) => void,
    options?: { size?: number },
  ): void;
}

export interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Marker: new (options: { map: KakaoMap; position: KakaoLatLng }) => KakaoOverlay;
  Circle: new (options: {
    map: KakaoMap;
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => KakaoOverlay;
  services: {
    Places: new () => KakaoPlacesService;
    Status: { OK: string; ZERO_RESULT: string; ERROR: string };
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let kakaoLoader: Promise<KakaoMaps> | null = null;

export function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  if (window.kakao?.maps.services) {
    return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao!.maps)));
  }
  if (kakaoLoader) return kakaoLoader;

  kakaoLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error("Kakao Maps SDK를 초기화하지 못했습니다."));
        return;
      }
      maps.load(() => resolve(maps));
    };
    script.onerror = () => reject(new Error("Kakao Maps SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return kakaoLoader;
}
