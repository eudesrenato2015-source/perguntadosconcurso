export function fmtMs(ms:number){const s=Math.max(0,Math.round(ms/1000));const m=Math.floor(s/60);const r=s%60;return m?`${m}:${String(r).padStart(2,'0')}`:`${r}s`;}
