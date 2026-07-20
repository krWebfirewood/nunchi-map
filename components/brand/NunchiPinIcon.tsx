type PinMood = "neutral" | "happy" | "worried" | "frown";

interface NunchiPinIconProps {
  mood?: PinMood;
  className?: string;
}

export function NunchiPinIcon({ mood = "happy", className = "" }: NunchiPinIconProps) {
  const pupilOffset = mood === "neutral" ? 1 : mood === "worried" || mood === "frown" ? -1 : 2;
  const mouth = mood === "happy"
    ? "M24 39 Q32 46 40 39"
    : mood === "neutral"
      ? "M27 41 Q32 42 37 41"
      : mood === "worried"
        ? "M27 43 Q32 38 37 43"
        : "M23 44 Q32 35 41 44";
  return (
    <svg className={`nunchi-pin-icon ${className}`} viewBox="0 0 64 76" aria-hidden="true" focusable="false">
      <path d="M32 3C16.4 3 5 14.4 5 29.7 5 49.2 32 73 32 73s27-23.8 27-43.3C59 14.4 47.6 3 32 3Z" fill="#f25f57" stroke="#d94b45" strokeWidth="2" />
      <path d="M15 17C18.7 10.7 25.5 7.5 32.8 7.5" fill="none" stroke="#ff9188" strokeWidth="5" strokeLinecap="round" opacity=".78" />
      {(mood === "worried" || mood === "frown") && <>
        <path d={mood === "frown" ? "M17 20 L27 23" : "M18 22 Q23 19 28 22"} fill="none" stroke="#71302d" strokeWidth="2.4" strokeLinecap="round" />
        <path d={mood === "frown" ? "M47 20 L37 23" : "M46 22 Q41 19 36 22"} fill="none" stroke="#71302d" strokeWidth="2.4" strokeLinecap="round" />
      </>}
      <ellipse cx="23" cy="29" rx="8" ry="9" fill="#fffdf7" />
      <ellipse cx="41" cy="29" rx="8" ry="9" fill="#fffdf7" />
      <circle cx={23 + pupilOffset} cy="30" r="3.8" fill="#17231f" />
      <circle cx={41 + pupilOffset} cy="30" r="3.8" fill="#17231f" />
      <circle cx={24 + pupilOffset} cy="28.8" r="1.2" fill="white" />
      <circle cx={42 + pupilOffset} cy="28.8" r="1.2" fill="white" />
      <path d={mouth} fill="none" stroke="#71302d" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
