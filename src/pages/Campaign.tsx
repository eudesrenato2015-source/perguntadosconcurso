import React from "react";
import type { Discipline } from "../types";
import { pickByDiscipline } from "../services/recommendation";
import { newSession } from "../services/session";
import { useNavigate } from "react-router-dom";
import { getCampaignState, CAMPAIGN_LEVELS } from "../services/campaign";

const districts: { discipline: Discipline; title: string; color: string; blurb: string }[] = [
  { discipline:"Português", title:"Distrito da Linguagem", color:"var(--cat-port)", blurb:"Leitura, pegadinhas e sintaxe." },
  { discipline:"Constitucional", title:"Distrito das Normas", color:"var(--cat-const)", blurb:"CF, direitos e princípios." },
  { discipline:"Administrativo", title:"Distrito da Administração", color:"var(--cat-adm)", blurb:"Atos, poderes e responsabilidades." },
  { discipline:"Penal/Proc Penal", title:"Distrito da Lei", color:"var(--cat-penal)", blurb:"Procedimento, segurança e disciplina." },
  { discipline:"DH/Criminologia", title:"Distrito da Proteção", color:"var(--cat-dh)", blurb:"DH, criminologia e mediação." },
  { discipline:"Informática/RLM", title:"Distrito Digital", color:"var(--cat-ti)", blurb:"TI, lógica e segurança." },
  { discipline:"Segurança Orgânica", title:"Distrito da Segurança", color:"var(--cat-seg)", blurb:"Segurança orgânica e protocolos." },
  { discipline:"História", title:"Distrito da História", color:"var(--cat-hist)", blurb:"História do Brasil e de Goiás." }
];

export default function Campaign(){
  const nav = useNavigate();
  const state = getCampaignState();

  const startLevel = (d: Discipline, level: number) => {
    const count = Math.min(8 + level*2, 14);
    const queue = pickByDiscipline(d, count);
    if (!queue.length) return;
    newSession("arena", queue, { discipline: d, label: `Campanha - ${d} - Fase ${level}` }, { campaign: { discipline: d, level } });
    nav("/questao");
  };

  const startBoss = (d: Discipline) => {
    const count = 15;
    const queue = pickByDiscipline(d, count);
    if (!queue.length) return;
    newSession("arena", queue, { discipline: d, label: `Boss - ${d}` }, { campaign: { discipline: d, level: CAMPAIGN_LEVELS + 1, boss: true }, timeLimitMs: 12 * 60 * 1000 });
    nav("/questao");
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Campanha</div>
      <div className="sub">Complete fases e derrote o boss final de cada distrito.</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        {districts.map(d => {
          const progress = state[d.discipline];
          const maxed = progress.level >= CAMPAIGN_LEVELS;
          return (
            <div key={d.discipline} className="kpi" style={{ gridColumn:"span 12" }}>
              <div className="row" style={{ justifyContent:"space-between" }}>
                <div>
                  <div className="h2" style={{ color: d.color }}>{d.title}</div>
                  <div className="sub">{d.blurb}</div>
                </div>
                <div className="pill">Nível {progress.level}/{CAMPAIGN_LEVELS}</div>
              </div>
              <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
                {[1,2,3].map(level => (
                  <button
                    key={level}
                    className="btn"
                    disabled={level > progress.level + 1}
                    onClick={() => startLevel(d.discipline, level)}
                  >
                    Fase {level}
                  </button>
                ))}
                <button className="btn btnPrimary" disabled={!maxed} onClick={() => startBoss(d.discipline)}>
                  Boss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
