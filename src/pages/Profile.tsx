import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAttempts } from "../services/db";
import { getActivePackIds, getAllPacks, getUserPacks, removeUserPack, setActivePackIds } from "../services/packs";
import { availableXp, applyTheme, getPlayerState, grantTheme } from "../services/progress";
import { achievements } from "../data/achievements";
import { themes } from "../data/themes";

export default function Profile(){
  const [attempts, setAttempts] = useState(0);
  const [acc, setAcc] = useState(0);
  const [activePacks, setActivePacks] = useState<string[]>(() => getActivePackIds());
  const [packNotice, setPackNotice] = useState<string | null>(null);
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [player, setPlayer] = useState(() => getPlayerState());

  const allPacks = useMemo(() => getAllPacks(), []);
  const userPackIds = useMemo(() => new Set(getUserPacks().map(p => p.id)), []);
  const xpAvailable = availableXp(player);

  useEffect(() => {
    (async () => {
      const a = await listAttempts(1000);
      setAttempts(a.length);
      const ok = a.filter(x=>x.isCorrect).length;
      setAcc(a.length ? Math.round((ok/a.length)*100) : 0);
      setPlayer(getPlayerState());
    })();
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), note: "Export simplificado. Codex pode ampliar." }, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rota190-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePack = (id: string) => {
    setActivePacks(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      if (!next.length){
        setPackNotice("Mantenha ao menos 1 pack ativo.");
        return prev;
      }
      setPackNotice(null);
      setActivePackIds(next);
      return next;
    });
  };

  const activateAll = () => {
    const ids = allPacks.map(p => p.id);
    setActivePackIds(ids);
    setActivePacks(ids);
    setPackNotice(null);
  };

  const removePack = (id: string) => {
    if (!userPackIds.has(id)) return;
    removeUserPack(id);
    const ids = getActivePackIds();
    setActivePacks(ids);
  };

  const applySelectedTheme = (themeId: string) => {
    applyTheme(themeId);
    setPlayer(getPlayerState());
    setShopNotice(null);
  };

  const buyTheme = (themeId: string, cost: number) => {
    setShopNotice(null);
    if (cost <= 0){
      applySelectedTheme(themeId);
      return;
    }
    const res = grantTheme(themeId, cost);
    setPlayer(res.state);
    if (!res.ok){
      setShopNotice("XP insuficiente para desbloquear este tema.");
      return;
    }
    applySelectedTheme(themeId);
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Perfil</div>
      <div className="sub">Configurações, packs e progresso local.</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div style={{ fontWeight: 900 }}>Tentativas</div>
          <div className="h2" style={{ marginTop: 6 }}>{attempts}</div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div style={{ fontWeight: 900 }}>Acerto</div>
          <div className="h2" style={{ marginTop: 6 }}>{acc}%</div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>XP & nível</div>
          <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
            <span className="pill">Nível {player.level}</span>
            <span className="pill">XP total {player.xp}</span>
            <span className="pill">Disponível {xpAvailable}</span>
            <span className="pill">Streak {player.streak} dias</span>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Loja cosmética</div>
          <div className="sub">Temas, skins e desbloqueios por XP (sem pagamento).</div>

          {shopNotice && (
            <div className="pill" style={{ marginTop: 8, color:"var(--warn-500)" }}>{shopNotice}</div>
          )}

          <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
            {themes.map(theme => {
              const unlocked = player.unlockedThemes.includes(theme.id);
              const active = player.activeTheme === theme.id;
              return (
                <div key={theme.id} className="row" style={{ justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{theme.name}</div>
                    <div className="sub">{theme.description}</div>
                  </div>
                  <div className="row" style={{ flexWrap:"wrap" }}>
                    <span className="pill" style={{ background: theme.accent + "33" }}>{theme.cost ? `${theme.cost} XP` : "Grátis"}</span>
                    <button
                      className={"btn " + (active ? "btnPrimary" : "")}
                      onClick={() => (unlocked ? applySelectedTheme(theme.id) : buyTheme(theme.id, theme.cost))}
                      disabled={active}
                    >
                      {active ? "Ativo" : unlocked ? "Aplicar" : "Comprar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Importar conteúdos</div>
          <div className="sub">Crie packs locais a partir de editais, aulas ou textos colados.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn btnPrimary" to="/importar">Abrir importador</Link>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Conquistas</div>
          <div className="sub">Progresso local (offline).</div>
          <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
            {achievements.map(a => (
              <div key={a.id} className="row" style={{ justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{a.title}</div>
                  <div className="sub">{a.description}</div>
                </div>
                <span className="pill" style={{ background: a.isUnlocked(player) ? "rgba(52,211,153,.18)" : "rgba(255,255,255,.06)" }}>
                  {a.isUnlocked(player) ? "Desbloqueada" : "Bloqueada"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Question Packs</div>
          <div className="sub">Ative/desative bancos de questões por disciplina.</div>

          {packNotice && (
            <div className="pill" style={{ marginTop: 8, color:"var(--warn-500)" }}>{packNotice}</div>
          )}

          <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
            {allPacks.map(pack => (
              <div key={pack.id} className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
                <label className="row" style={{ gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={activePacks.includes(pack.id)}
                    onChange={() => togglePack(pack.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 800 }}>{pack.name}</div>
                    <div className="sub">{pack.discipline} • {pack.questions.length} questões</div>
                  </div>
                </label>
                {userPackIds.has(pack.id) && (
                  <button className="btn" onClick={() => removePack(pack.id)}>Remover</button>
                )}
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={activateAll}>Ativar todos</button>
          </div>
          <div className="sub" style={{ marginTop: 6 }}>A seleção afeta Arena, Biblioteca e Duelo.</div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Exportar</div>
          <div className="sub">Baixe um JSON. (O Codex pode expandir para export total.)</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={exportData}>Exportar</button>
          </div>
        </div>
      </div>
    </div>
  );
}


