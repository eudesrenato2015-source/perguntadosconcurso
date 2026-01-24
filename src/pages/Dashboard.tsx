import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAttempts } from "../services/db";
import { buildRecommendedQueue } from "../services/recommendation";
import { newSession } from "../services/session";
import { getActiveQuestions } from "../services/packs";
import { getPlayerState } from "../services/progress";
import StatIcon from "../components/StatIcon";

export default function Dashboard(){
  const nav = useNavigate();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pool = useMemo(() => getActiveQuestions(), []);
  const player = getPlayerState();

  useEffect(() => {
    (async () => {
      const a = await listAttempts(1200);
      setAttempts(a);
      setLoading(false);
    })();
  }, []);

  const total = attempts.length;
  const ok = attempts.filter(a => a.isCorrect).length;
  const acc = total ? Math.round((ok / total) * 100) : 0;
  const avgTime = total ? Math.round(attempts.reduce((s,a)=>s+a.timeSpentMs,0) / total / 1000) : 0;

  const byDay = useMemo(() => {
    const days: { label: string; total: number; ok: number }[] = [];
    const today = new Date();
    for (let i=13;i>=0;i--){
      const d = new Date(today);
      d.setDate(today.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const dayAttempts = attempts.filter(a => new Date(a.createdAt).toISOString().slice(0,10) === key);
      days.push({ label: key.slice(8,10), total: dayAttempts.length, ok: dayAttempts.filter(a=>a.isCorrect).length });
    }
    return days;
  }, [attempts]);

  const weakTopics = useMemo(() => {
    const map = new Map<string, { ok: number; total: number }>();
    attempts.forEach(att => {
      const q = pool.find(item => item.id === att.questionId);
      if (!q) return;
      const key = `${q.discipline} · ${q.topic}`;
      const cur = map.get(key) ?? { ok: 0, total: 0 };
      cur.total += 1;
      if (att.isCorrect) cur.ok += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([key, stat]) => ({ key, acc: stat.total ? stat.ok / stat.total : 0, total: stat.total }))
      .sort((a,b)=>a.acc-b.acc)
      .slice(0, 8);
  }, [attempts, pool]);

  const startRecommended = async () => {
    const queue = await buildRecommendedQueue(12);
    if (!queue.length) return;
    newSession("dashboard", queue, { label: "Treino Recomendado" });
    nav("/questao");
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Dashboard</div>
      <div className="sub">Seu painel de desempenho (offline).</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="row">
              <div className="pill" style={{ padding: 6 }}><StatIcon name="accuracy" /></div>
              <div style={{ fontWeight: 900 }}>Acerto geral</div>
            </div>
          </div>
          <div className="h1" style={{ marginTop: 6 }}>{acc}%</div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="row">
              <div className="pill" style={{ padding: 6 }}><StatIcon name="time" /></div>
              <div style={{ fontWeight: 900 }}>Tempo médio</div>
            </div>
          </div>
          <div className="h1" style={{ marginTop: 6 }}>{avgTime}s</div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="row">
              <div className="pill" style={{ padding: 6 }}><StatIcon name="streak" /></div>
              <div style={{ fontWeight: 900 }}>Streak</div>
            </div>
          </div>
          <div className="h1" style={{ marginTop: 6 }}>{player.streak}d</div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div className="row">
              <div className="pill" style={{ padding: 6 }}><StatIcon name="level" /></div>
              <div style={{ fontWeight: 900 }}>Nível</div>
            </div>
          </div>
          <div className="h1" style={{ marginTop: 6 }}>{player.level}</div>
        </div>
      </div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Evolução (14 dias)</div>
          <div className="sub">Tentativas e acerto diário.</div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={byDay.map(d => d.total)} ok={byDay.map(d => d.ok)} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(14, 1fr)", gap: 4, marginTop: 8 }}>
              {byDay.map((d, idx) => (
                <div key={idx} style={{ textAlign:"center", fontSize: 10, color:"var(--ink-500)" }}>{d.label}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Mapa de calor (tópicos críticos)</div>
          <div className="sub">Mais errados recentemente.</div>
          <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
            {weakTopics.length === 0 && (
              <div className="sub">Sem dados suficientes ainda.</div>
            )}
            {weakTopics.map(item => (
              <div key={item.key} className="row" style={{ justifyContent:"space-between", gap: 12, flexWrap:"wrap" }}>
                <div className="sub" style={{ flex:1 }}>{item.key}</div>
                <div style={{ width: 140, height: 10, borderRadius: 999, background:"rgba(255,255,255,.08)", border:"1px solid var(--line-200)", overflow:"hidden" }}>
                  <div style={{ width: `${Math.round(item.acc*100)}%`, height:"100%", background:"linear-gradient(90deg, var(--bad-500), var(--warn-500))" }} />
                </div>
                <div className="pill">{Math.round(item.acc*100)}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Treino recomendado</div>
          <div className="sub">Mistura revisão vencida + erradas recentes + tópicos fracos.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btnPrimary" onClick={startRecommended} disabled={loading || total===0}>Começar agora</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, ok }: { data: number[]; ok: number[] }){
  const max = Math.max(1, ...data);
  const points = data.map((v, i) => {
    const x = (i/(data.length-1)) * 100;
    const y = 44 - (v / max) * 34;
    return `${x},${y}`;
  }).join(" ");

  const area = `0,44 ${points} 100,44`;

  const accLine = data.map((v, i) => {
    const acc = v ? ok[i] / v : 0;
    const x = (i/(data.length-1)) * 100;
    const y = 44 - (acc) * 34;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 44" width="100%" height="90">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-500)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sparkAcc" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--accent-500)" stopOpacity=".9" />
          <stop offset="100%" stopColor="var(--warn-500)" stopOpacity=".9" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="44" fill="rgba(255,255,255,.03)" rx="6" />
      <polygon points={area} fill="url(#sparkFill)" />
      <polyline fill="none" stroke="var(--brand-500)" strokeWidth="2.4" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <polyline fill="none" stroke="url(#sparkAcc)" strokeWidth="2" points={accLine} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

