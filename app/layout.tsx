import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "눈치맵 | 익명 동선 조정 캘린더",
  description: "정확한 개인 일정을 공개하지 않고 일정과 지역의 겹침 가능성을 확인하세요.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
