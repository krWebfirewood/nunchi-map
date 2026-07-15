import { NunchiApp } from "@/components/NunchiApp";

export default function Home() {
  const initialDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <NunchiApp initialDate={initialDate} />;
}
