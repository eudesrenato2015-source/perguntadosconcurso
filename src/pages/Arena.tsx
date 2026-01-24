import React, { useState } from "react";
import Wheel from "../components/Wheel";
import Mascot from "../components/Mascot";
import { buildDailyQueue, pickByDiscipline } from "../services/recommendation";
import { newSession } from "../services/session";
import type { Discipline } from "../types";
import { useNavigate } from "react-router-dom";
import { getActiveQuestions } from "../services/packs";

export default function Arena(){
  const nav = useNavigate();
  const [lastPick, setLastPick] = useState<Discipline | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activePool = React.useMemo(() => getActiveQuestions(), []);
  const availableDisciplines = React.useMemo(() => {
    const set = new Set(activePool.map(q => q.discipline));
    return Array.from(set.values());
  }, [activePool]);

  const startPicked = (d: Discipline) => {
    setLastPick(d);
    const queue = pickByDiscipline(d, 5, { shuffle: true });
    if (!queue.length){
      setNotice("Sem questões ativas para esta disciplina. Ative packs no Perfil.");
      return;
    }
    setNotice(null);
    newSession("arena", queue, { discipline: d, label: `Arena • ${d}` });
    nav("/questao");
  };

  const daily = async () => {
    const queue = await buildDailyQueue(10);
    if (!queue.length){
      setNotice("Sem questões ativas para o desafio diário. Ative packs no Perfil.");
      return;
    }
    setNotice(null);
    newSession("daily", queue, { label: "Desafio Diário" });
    nav("/questao");
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div className="h2">Arena</div>
          <div className="sub">Gire a roda e jogue uma rodada curta. Pop, rápido, eficiente.</div>
        </div>
        <Mascot mood={lastPick ? "hype" : "neutral"} />
      </div>

      {notice && (
        <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>
          {notice}
        </div>
      )}

      <div style={{ marginTop: 14 }} className="card">
        <div style={{ padding: 16 }}>
          <Wheel onPick={startPicked} disciplines={availableDisciplines} disabled={!availableDisciplines.length} />
        </div>
      </div>
      {!availableDisciplines.length && (
        <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>
          Sem disciplinas ativas. Ative packs no Perfil.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)", marginTop: 12 }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Operação do Dia</div>
          <div className="sub">10 questões misturadas: revisão vencida + erradas recentes + novas.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btnPrimary" onClick={daily}>Começar desafio</button>
          </div>
        </div>
      </div>

      <div className="sep" />
      <div className="sub">Dica: para escolher manualmente e filtrar por tipo/dificuldade, vá em <b>Biblioteca</b>.</div>
    </div>
  );
}

