import React, { useEffect, useState } from "react";
import type { Discipline } from "../types";
import { pickByDiscipline } from "../services/recommendation";
import { newSession } from "../services/session";
import { useNavigate } from "react-router-dom";
import { CAMPAIGN_LEVELS, getCampaignState } from "../services/campaign";

const districts: { discipline: Discipline; title: string; color: string; blurb: string }[] = [
  { discipline:"Português", title:"Distrito da Linguagem", color:"var(--cat-port)", blurb:"Leitura, pegadinhas e sintaxe." },
  { discipline:"Constitucional", title:"Distrito das Normas", color:"var(--cat-const)", blurb:"CF, direitos e princípios." },
  { discipline:"Administrativo", title:"Distrito da Administração", color:"var(--cat-adm)", blurb:"Atos, poderes e responsabilidades." },
  { discipline:"Penal/Proc Penal", title:"Distrito da Lei", color:"var(--cat-penal)", blurb:"Procedimento, segurança e disciplina." },
  { discipline:"DH/Criminologia", title:"Distrito da Proteção", color:"var(--cat-dh)", blurb:"DH, criminologia e mediação." },
  { discipline:"Informática/RLM", title:"Distrito Digital", color:"var(--cat-ti)", blurb:"TI, lógica e segurança." }
];

export default function Campaign(){
  const nav = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState(() => getCampaignState());

  useEffect(() => {
    const refresh = () => setProgress(getCampaignState());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const startLevel = (d: Discipline, level: number) => {
    const count = 10;
    const queue = pickByDiscipline(d, count);
    if (!queue.length){
      setNotice("Sem questões ativas para este distrito. Ative packs no Perfil.");
      return;
    }
    setNotice(null);
    newSession("arena", queue, { discipline: d, label: `Campanha - ${d} - Fase ${level}` }, { campaign: { discipline: d, level } });
    nav("/questao");
  };

  const startBoss = (d: Discipline) => {
    const count = 15;
    const queue = pickByDiscipline(d, count);
    if (!queue.length){
      setNotice("Sem questões ativas para este distrito. Ative packs no Perfil.");
      return;
    }
    setNotice(null);
    newSession("arena", queue, { discipline: d, label: `Boss - ${d}` }, { campaign: { discipline: d, level: CAMPAIGN_LEVELS + 1, boss: true }, timeLimitMs: 12 * 60 * 1000 });
    nav("/questao");
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Campanha</div>
      <div className="sub">Fases por distrito e chefões com tempo total.</div>

      <div className="sep" />

      {notice && (
        <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>
          {notice}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        {districts.map((d) => {
          const state = progress[d.discipline];
          const completed = state?.level ?? 0;
          const bossUnlocked = completed >= CAMPAIGN_LEVELS;
          const bossDefeated = state?.bossDefeated ?? false;

          return (
            <div key={d.discipline} className="kpi" style={{
              gridColumn:"span 12",
              border: "1px solid var(--line-200)",
              background: `linear-gradient(135deg, ${d.color}22, rgba(255,255,255,.04))`
            }}>
              <div className="row" style={{ justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{d.title}</div>
                  <div className="sub">{d.blurb}</div>
                  <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
                    <span className="pill">Fases concluídas: {completed}/{CAMPAIGN_LEVELS}</span>
                    {bossDefeated && <span className="pill">Boss derrotado</span>}
                  </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
                {Array.from({ length: CAMPAIGN_LEVELS }).map((_, idx) => {
                  const level = idx + 1;
                  const unlocked = level <= completed + 1;
                  const done = level <= completed;
                  return (
                    <button
                      key={level}
                      className={"btn " + (done ? "btnPrimary" : "")}
                      disabled={!unlocked}
                      onClick={() => startLevel(d.discipline, level)}
                    >
                      {done ? `Fase ${level} ok` : `Fase ${level}`}
                    </button>
                  );
                })}

                <button
                  className={"btn " + (bossDefeated ? "btnPrimary" : "")}
                  disabled={!bossUnlocked}
                  onClick={() => startBoss(d.discipline)}
                >
                  {bossDefeated ? "Boss ok" : "Boss"}
                </button>
              </div>

              <div className="sub" style={{ marginTop: 6 }}>Boss: 15 questões, 12 minutos.</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


