import React, { useMemo, useState } from "react";
import type { Discipline } from "../types";
import { DISCIPLINES } from "../data/disciplines";

type Slice = { key: string; label: string; colorVar: string };

const sliceMap: Record<Discipline, Slice> = {
  "Português": { key: "Português", label: "Port.", colorVar: "var(--cat-port)" },
  "Constitucional": { key: "Constitucional", label: "Const.", colorVar: "var(--cat-const)" },
  "Administrativo": { key: "Administrativo", label: "Adm.", colorVar: "var(--cat-adm)" },
  "Penal/Proc Penal": { key: "Penal/Proc Penal", label: "Penal", colorVar: "var(--cat-penal)" },
  "Informática/RLM": { key: "Informática/RLM", label: "TI/RLM", colorVar: "var(--cat-ti)" },
  "Segurança Orgânica": { key: "Segurança Orgânica", label: "Seg.", colorVar: "var(--cat-seg)" },
  "História": { key: "História", label: "Hist.", colorVar: "var(--cat-hist)" }
};

const crownSlice: Slice = { key: "__CROWN__", label: "Coroa", colorVar: "var(--accent-500)" };

function polarToCartesian(cx:number, cy:number, r:number, angleDeg:number){
  const a = (angleDeg - 90) * Math.PI / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx:number, cy:number, r:number, startAngle:number, endAngle:number){
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export default function Wheel({
  onPick,
  disabled,
  forcePick,
  forceCrown,
  includeCrown,
  onCrown,
  showHint = true,
  disciplines
}: {
  onPick: (d: Discipline)=>void;
  disabled?: boolean;
  forcePick?: Discipline;
  forceCrown?: boolean;
  includeCrown?: boolean;
  onCrown?: ()=>void;
  showHint?: boolean;
  disciplines?: Discipline[];
}){
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const slices = useMemo(() => {
    const base = (disciplines && disciplines.length ? disciplines : DISCIPLINES)
      .filter((d, i, arr) => arr.indexOf(d) === i);
    const mapped = base.map(d => sliceMap[d] ?? {
      key: d,
      label: d.slice(0, 6),
      colorVar: "var(--accent-500)"
    });
    if (includeCrown) mapped.push(crownSlice);
    return mapped;
  }, [disciplines, includeCrown]);
  const labelSize = slices.length >= 8 ? 10 : slices.length >= 7 ? 11 : 12;

  const paths = useMemo(() => {
    const cx = 160, cy = 160, r = 136;
    if (!slices.length) return [];
    const step = 360 / slices.length;
    return slices.map((s, i) => {
      const a0 = i * step;
      const a1 = (i+1) * step;
      return { ...s, path: describeArc(cx, cy, r, a0, a1), mid: a0 + step/2 };
    });
  }, [slices]);

  const spin = () => {
    if (disabled || spinning || !slices.length) return;
    setSpinning(true);
    const extra = 360 * (3 + Math.floor(Math.random()*3));
    const forcedIndex = forcePick ? slices.findIndex(s => s.key === forcePick) : -1;
    const crownIndex = forceCrown ? slices.findIndex(s => s.key === "__CROWN__") : -1;
    const target = crownIndex >= 0 ? crownIndex : forcedIndex >= 0 ? forcedIndex : Math.floor(Math.random() * slices.length);
    const step = 360 / slices.length;
    const desired = 360 - (target*step + step/2);
    const final = rot + extra + desired;
    setRot(final);
    window.setTimeout(() => {
      setSpinning(false);
      if (slices[target].key === "__CROWN__"){
        onCrown?.();
      } else {
        onPick(slices[target].key as Discipline);
      }
    }, 1000);
  };

  return (
    <div style={{ display:"grid", placeItems:"center", gap: 12 }}>
      <div style={{ position:"relative", width: "min(340px, 100%)", aspectRatio:"1 / 1" }}>
        <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", zIndex:5 }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderBottom: "20px solid rgba(255,255,255,.92)",
            filter:"drop-shadow(0 6px 18px rgba(0,0,0,.35))"
          }}/>
        </div>

        <svg width="100%" height="100%" viewBox="0 0 320 320" style={{
          transform: `rotate(${rot}deg)` ,
          transition: spinning ? "transform 1000ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "transform 280ms ease",
          filter: "drop-shadow(0 18px 45px rgba(0,0,0,.35))"
        }}>
          <defs>
            <radialGradient id="ring" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,.12)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,.02)"/>
            </radialGradient>
            <radialGradient id="hub" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,.30)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,.06)"/>
            </radialGradient>
          </defs>
          <circle cx="160" cy="160" r="152" fill="url(#ring)" stroke="rgba(255,255,255,.18)" />
          {paths.map((p) => (
            <g key={p.key}>
              <path d={p.path} fill={p.colorVar} opacity={0.92} stroke="rgba(0,0,0,.08)" />
              <text
                x="160" y="160"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelSize}
                fill="rgba(0,0,0,.75)"
                transform={`rotate(${p.mid} 160 160) translate(0 -108) rotate(${-p.mid} 160 160)`}
                style={{ fontWeight: 900 }}
              >
                {p.key === "__CROWN__" ? "👑" : p.label}
              </text>
            </g>
          ))}
          <circle cx="160" cy="160" r="52" fill="url(#hub)" stroke="rgba(255,255,255,.28)" />
          <circle cx="160" cy="160" r="7" fill="rgba(255,255,255,.75)" />
        </svg>

        <div style={{ position:"absolute", inset:0 }}>
          <button
            className="btn btnPrimary wheelBtn"
            onClick={spin}
            disabled={disabled || spinning || !slices.length}
            aria-label="Girar roleta"
            style={{
              position:"absolute",
              left:"50%",
              top:"50%",
              transform:"translate(-50%, -50%)",
              minWidth: 120,
              boxShadow:"0 12px 30px rgba(24,210,163,.35)"
            }}
          >
            {spinning ? "Girando..." : "Girar"}
          </button>
        </div>
      </div>
      {showHint && (
        <div className="sub" style={{ textAlign:"center" }}>Dica: se preferir, vá na Biblioteca e escolha manualmente.</div>
      )}
    </div>
  );
}
