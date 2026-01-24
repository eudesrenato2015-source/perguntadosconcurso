import React from "react";

export type StatIconName = "accuracy" | "time" | "streak" | "level";

export default function StatIcon({ name, size = 18 }: { name: StatIconName; size?: number }){
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === "accuracy" && (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <circle cx="12" cy="12" r="3" {...common} />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" {...common} />
        </>
      )}
      {name === "time" && (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M12 7v5l3 2" {...common} />
        </>
      )}
      {name === "streak" && (
        <>
          <path d="M12 3c3 3 4 5 4 8a4 4 0 1 1-8 0c0-2 1-4 4-8Z" {...common} />
          <path d="M10 18c0 1.1.9 2 2 2s2-.9 2-2" {...common} />
        </>
      )}
      {name === "level" && (
        <>
          <path d="M12 4l3 6 6 .7-4.5 4 1.2 6.3L12 17l-5.7 4 1.2-6.3L3 10.7 9 10z" {...common} />
        </>
      )}
    </svg>
  );
}
