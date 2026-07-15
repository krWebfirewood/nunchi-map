import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GettingStarted } from "@/components/onboarding/GettingStarted";

describe("GettingStarted", () => {
  it("그룹과 일정이 없으면 시작 행동을 안내한다", () => {
    const html = renderToStaticMarkup(createElement(GettingStarted, { hasGroup: false, hasSchedule: false, onGroupSetup: vi.fn(), onScheduleSetup: vi.fn() }));
    expect(html).toContain("그룹 설정");
    expect(html).toContain("일정 등록");
    expect(html).toContain("다음 단계");
  });

  it("완료된 단계와 지도 준비 상태를 표시한다", () => {
    const html = renderToStaticMarkup(createElement(GettingStarted, { hasGroup: true, hasSchedule: true, onGroupSetup: vi.fn(), onScheduleSetup: vi.fn() }));
    expect(html.match(/완료/g)).toHaveLength(2);
    expect(html).toContain("준비됨");
  });
});
