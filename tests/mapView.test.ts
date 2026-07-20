import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapView, type MapSchedule } from "@/components/map/MapView";

const baseProps = {
  locationName: "당산",
  latitude: 37.5345,
  longitude: 126.9026,
  radiusMeters: 500,
  conflictState: "unchecked" as const,
  selectedDate: "2030-01-15",
  liveLocations: [],
  liveLocationGroupName: null,
};

const schedules: MapSchedule[] = [{
  id: "own-1",
  startMinutes: 600,
  endMinutes: 720,
  locationName: "당산",
  latitude: 37.5345,
  longitude: 126.9026,
  radiusMeters: 500,
  source: "own",
}];

describe("MapView 시간대 탐색 UI", () => {
  it("선택 날짜에 일정이 있으면 시간 슬라이더와 하루 전체 버튼을 표시한다", () => {
    const html = renderToStaticMarkup(createElement(MapView, { ...baseProps, schedules }));
    expect(html).toContain("시간대 탐색");
    expect(html).toContain("하루 전체");
    expect(html).toContain('type="range"');
    expect(html).toContain("하루 일정 1개");
  });

  it("일정이 없으면 지도 시간 탐색기를 표시하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(MapView, { ...baseProps, schedules: [] }));
    expect(html).not.toContain("지도 시간대 탐색");
    expect(html).not.toContain('type="range"');
  });

  it("선택한 그룹의 활성 위치 인원을 지도에 표시한다", () => {
    const html = renderToStaticMarkup(createElement(MapView, {
      ...baseProps,
      schedules: [],
      liveLocationGroupName: "주말 모임",
      liveLocations: [{
        userId: "user-1",
        nickname: "지각대장",
        latitude: 37.5,
        longitude: 127,
        accuracyMeters: 12,
        updatedAt: "2030-01-15T10:00:00.000Z",
        isMe: true,
      }],
    }));
    expect(html).toContain("주말 모임 · 현재 위치 1명");
  });
});
