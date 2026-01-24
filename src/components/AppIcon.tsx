import React from "react";

export type IconName =
  | "arena"
  | "dashboard"
  | "duel"
  | "campaign"
  | "library"
  | "review"
  | "profile"
  | "import";

export default function AppIcon({ name, size = 20 }: { name: IconName; size?: number }){
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === "arena" && (
        <>
          <circle cx="12" cy="12" r="9" {...common} />
          <path d="M12 7v10M7 12h10" {...common} />
        </>
      )}
      {name === "dashboard" && (
        <>
          <path d="M4 18h16" {...common} />
          <path d="M6 16l4-6 4 3 4-7" {...common} />
        </>
      )}
      {name === "duel" && (
        <>
          <path d="M7 4l10 10M17 4L7 14" {...common} />
          <path d="M5 18h4M15 18h4" {...common} />
        </>
      )}
      {name === "campaign" && (
        <>
          <path d="M6 20V6l6-2 6 2v14" {...common} />
          <path d="M6 10h12" {...common} />
        </>
      )}
      {name === "library" && (
        <>
          <path d="M5 5h10v14H5z" {...common} />
          <path d="M15 7h4v12h-4" {...common} />
        </>
      )}
      {name === "review" && (
        <>
          <path d="M4 12a8 8 0 1 0 3-6" {...common} />
          <path d="M4 4v4h4" {...common} />
        </>
      )}
      {name === "profile" && (
        <>
          <circle cx="12" cy="9" r="3" {...common} />
          <path d="M5 20c2-3 12-3 14 0" {...common} />
        </>
      )}
      {name === "import" && (
        <>
          <path d="M12 4v10" {...common} />
          <path d="M8 8l4-4 4 4" {...common} />
          <path d="M4 20h16" {...common} />
        </>
      )}
    </svg>
  );
}
