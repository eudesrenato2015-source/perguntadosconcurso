import React, { useEffect, useState } from "react";
import { fetchDailyRanking, fetchPeriodRanking } from "../services/profile";

export default function Ranking(){
  const [items, setItems] = useState<Array<{ display_name: string; xp: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day"|"week"|"month">("day");

  useEffect(() => {
    (async () => {
      try {
        const data = period === "day"
          ? await fetchDailyRanking(50)
          : await fetchPeriodRanking(period === "week" ? 7 : 30, 50);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Ranking</div>
      <div className="sub">XP acumulado no período.</div>

      <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
        <button className="btn" onClick={() => setPeriod("day")} style={{ background: period === "day" ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}>Diário</button>
        <button className="btn" onClick={() => setPeriod("week")} style={{ background: period === "week" ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}>Semanal</button>
        <button className="btn" onClick={() => setPeriod("month")} style={{ background: period === "month" ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}>Mensal</button>
      </div>

      <div className="sep" />

      {loading && <div className="sub">Carregando...</div>}
      {!loading && items.length === 0 && <div className="sub">Sem dados ainda.</div>}

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        {items.map((item, idx) => (
          <div key={idx} className="kpi" style={{ gridColumn:"span 12" }}>
            <div className="row" style={{ justifyContent:"space-between" }}>
              <div style={{ fontWeight: 900 }}>#{idx+1} {item.display_name}</div>
              <div className="pill">{item.xp} XP</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
