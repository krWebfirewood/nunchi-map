"use client";

import { useState, type FormEvent } from "react";
import { loadKakaoMaps, type KakaoPlaceResult } from "@/lib/kakao/maps";
import { DEMO_LOCATIONS } from "@/lib/locations";

export interface SelectedLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationSearchProps {
  selectedName: string;
  onSelect(location: SelectedLocation): void;
}

export function LocationSearch({ selectedName, onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KakaoPlaceResult[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY?.trim() ?? "";

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setStatusMessage("검색할 장소명이나 주소를 입력해 주세요.");
      return;
    }
    if (!appKey) {
      setStatusMessage("카카오 지도 키가 없어 빠른 선택만 사용할 수 있습니다.");
      return;
    }

    setSearching(true);
    setStatusMessage("");
    try {
      const maps = await loadKakaoMaps(appKey);
      const places = new maps.services.Places();
      places.keywordSearch(keyword, (items, status) => {
        setSearching(false);
        if (status === maps.services.Status.OK) {
          setResults(items);
          setStatusMessage(`${items.length}개 장소를 찾았습니다.`);
        } else if (status === maps.services.Status.ZERO_RESULT) {
          setResults([]);
          setStatusMessage("검색 결과가 없습니다. 지역명이나 도로명 주소를 함께 입력해 보세요.");
        } else {
          setResults([]);
          setStatusMessage("장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        }
      }, { size: 8 });
    } catch {
      setSearching(false);
      setResults([]);
      setStatusMessage("카카오 장소 검색을 불러오지 못했습니다.");
    }
  }

  function choosePlace(place: KakaoPlaceResult) {
    onSelect({
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      latitude: Number(place.y),
      longitude: Number(place.x),
    });
    setQuery(place.place_name);
    setResults([]);
    setStatusMessage(`${place.place_name}을(를) 선택했습니다.`);
  }

  return (
    <div className="location-search">
      <span className="field-label">장소</span>
      <form className="location-search-bar" onSubmit={(event) => void search(event)}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 서울역, 부산 해운대구청, 도로명 주소"
          aria-label="장소명 또는 주소"
        />
        <button type="submit" disabled={searching}>{searching ? "검색 중…" : "전국 검색"}</button>
      </form>
      <div className="location-quick-list" aria-label="빠른 장소 선택">
        {DEMO_LOCATIONS.map((location) => (
          <button
            type="button"
            className={selectedName === location.name ? "active" : ""}
            key={location.name}
            onClick={() => onSelect({ ...location, address: `${location.name} 중심` })}
          >
            {location.name}
          </button>
        ))}
      </div>
      {statusMessage && <p className="location-search-status" role="status">{statusMessage}</p>}
      {results.length > 0 && (
        <ul className="location-results">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => choosePlace(place)}>
                <strong>{place.place_name}</strong>
                <span>{place.road_address_name || place.address_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
