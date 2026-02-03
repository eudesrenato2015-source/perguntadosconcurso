import React, { useEffect, useMemo, useState } from "react";
import { dueSR, listAttempts, listSR } from "../services/db";
import { newSession } from "../services/session";
import { useNavigate } from "react-router-dom";
import { getActiveQuestions } from "../services/packs";
import { useQuestionOverridesVersion } from "../hooks/useQuestionOverrides";

export default function Review(){
  const nav = useNavigate();
  const [tab, setTab] = useState<"Espaçada"|"Erradas">("Espaçada");
  const [due, setDue] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<{ day: string; count: number }[]>([]);
  const overridesVersion = useQuestionOverridesVersion();

  useEffect(() => {
    (async () => {
      const sr = await dueSR(Date.now(), 50);
      setDue(sr.map(i => i.questionId));
      const att = await listAttempts(400);
      const w = att.filter(a => !a.isCorrect).map(a => a.questionId);
      const uniq: string[] = [];
      for (const id of w){
        if (!uniq.includes(id)) uniq.push(id);
        if (uniq.length >= 30) break;
      }
      setWrong(uniq);

      const all = await listSR();
      const today = new Date();
      const days: { day: string; count: number }[] = [];
      for (let i=0;i<7;i++){
        const d = new Date(today);
        d.setDate(today.getDate()+i);
        const key = d.toISOString().slice(0,10);
        const start = new Date(key).getTime();
        const end = start + 86400000;
        const count = all.filter(item => item.nextReviewAt >= start && item.nextReviewAt < end).length;
        days.push({ day: key, count });
      }
      setCalendar(days);
    })();
  }, []);

  const ids = tab === "Espaçada" ? due : wrong;

  const start = () => {
    if (ids.length === 0) return;
    newSession("review", ids.slice(0, tab === "Espaçada" ? 10 : 15), { label: `Revisão • ${tab}` });
    nav("/questao");
  };

  const preview = useMemo(() => {
    const pool = getActiveQuestions();
    return ids.slice(0, 6).map(id => pool.find(q => q.id === id)).filter(Boolean) as any[];
  }, [ids, overridesVersion]);

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Revisão</div>
      <div className="sub">Aqui mora tua aprovação: erradas + revisão espaçada.</div>

      <div className="row" style={{ marginTop: 12, flexWrap:"wrap" }}>
        {(["Espaçada","Erradas"] as const).map(t => (
          <button key={t} className="btn" style={{ background: tab===t ? "rgba(20,160,255,.20)" : "rgba(255,255,255,.06)" }} onClick={()=>setTab(t)}>
            {t}
          </button>
        ))}
        <span className="pill" style={{ marginLeft:"auto", color:"var(--ink-500)" }}>{ids.length} na fila</span>
      </div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>{tab === "Espaçada" ? "Revisar agora (10)" : "Treinar erradas (até 15)"}</div>
          <div className="sub">O app monta uma fila e vai registrando teu desempenho.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btnPrimary" onClick={start} disabled={ids.length===0}>Começar</button>
          </div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Próximos 7 dias</div>
          <div className="sub">Calendário simples da revisão espaçada.</div>
          <div style={{ marginTop: 10, display:"grid", gap: 8, gridTemplateColumns:"repeat(7, 1fr)" }}>
            {calendar.map(item => (
              <div key={item.day} className="pill" style={{ justifyContent:"center" }}>
                <span>{item.day.slice(8,10)}</span>
                <span style={{ color:"var(--ink-500)" }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sep" />

      <div className="sub" style={{ marginBottom: 8 }}>Prévia</div>
      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        {preview.map((q) => (
          <div key={q.id} className="kpi" style={{ gridColumn:"span 12" }}>
            <div style={{ fontWeight: 900 }}>{q.discipline} • D{q.difficulty} • {q.type}</div>
            <div className="sub" style={{ marginTop: 6 }}>{q.statement}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

