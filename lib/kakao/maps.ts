export type KakaoLatLng = object;

export interface KakaoMap {
  setCenter(position: KakaoLatLng): void;
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
  relayout(): void;
}

export interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void;
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
  LatLngBounds: new () => KakaoLatLngBounds;
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
    strokeStyle?: string;
  }) => KakaoOverlay;
  CustomOverlay: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement | string;
    yAnchor?: number;
    zIndex?: number;
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

export async function searchKakaoPlaces(appKey: string, keyword: string, size = 8): Promise<KakaoPlaceResult[]> {
  const maps = await loadKakaoMaps(appKey);
  const places = new maps.services.Places();
  return new Promise((resolve, reject) => {
    places.keywordSearch(keyword, (items, status) => {
      if (status === maps.services.Status.OK) resolve(items);
      else if (status === maps.services.Status.ZERO_RESULT) resolve([]);
      else reject(new Error("카카오 장소 검색에 실패했습니다."));
    }, { size });
  });
}
