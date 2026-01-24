import React from "react";

export default function Mascot({ mood="neutral", size=64 }: { mood?: "neutral"|"hype"|"think"|"coach"|"duel"; size?: number }){
  const badge = mood === "hype" ? "+" : mood === "think" ? "?" : mood === "coach" ? "!" : mood === "duel" ? "*" : "";
  const mouth = mood === "think" ? "M38 70 C46 62, 54 62, 62 70" : "M38 68 C46 76, 54 76, 62 68";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Mascote" role="img">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="var(--brand-500)"/>
          <stop offset="1" stopColor="var(--accent-500)"/>
        </linearGradient>
      </defs>
      <rect x="12" y="16" width="76" height="72" rx="20" fill="rgba(255,255,255,.06)" stroke="var(--line-300)"/>
      <rect x="26" y="10" width="48" height="14" rx="8" fill="url(#g)"/>
      <circle cx="38" cy="52" r="6" fill="var(--ink-900)"/>
      <circle cx="62" cy="52" r="6" fill="var(--ink-900)"/>
      <path d={mouth} stroke="var(--ink-900)" strokeWidth="5" fill="none" strokeLinecap="round"/>
      {badge && (
        <text x="50" y="40" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,.65)">{badge}</text>
      )}
    </svg>
  );
}
