import React, { useEffect, useState } from "react";
import { fetchDailyRanking } from "../services/profile";

export default function Ranking(){
  const [items, setItems] = useState<Array<{ display_name: string; xp: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDailyRanking(50);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Ranking Diário</div>
      <div className="sub">XP acumulado do dia.</div>

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
