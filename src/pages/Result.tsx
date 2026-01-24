import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, clearSession, patchSession } from "../services/session";
import { listAttempts } from "../services/db";
import { recordCampaignResult } from "../services/campaign";
import { awardBonusXp } from "../services/progress";
import { closeDuelChannel, subscribeDuelEvents } from "../services/online";

export default function Result(){
  const nav = useNavigate();
  const s = getSession();
  const [my, setMy] = useState({ ok:0, total:0, score:0, acc:0 });
  const [ghost, setGhost] = useState<any>(null);
  const [peerScore, setPeerScore] = useState<number | null>(null);
  const [campaignInfo, setCampaignInfo] = useState<any>(null);

  useEffect(() => {
    if (!s){ nav("/"); return; }
    (async () => {
      const a = await listAttempts(200);
      const last = a.slice(0, s.queue.length);
      const ok = last.filter(x=>x.isCorrect).length;
      const total = last.length;
      const acc = total ? ok/total : 0;
      const meta = (s.meta as any) ?? {};
      const score = Number(meta?.myScore ?? (ok*100));
      setMy({ ok, total, score, acc });
      setGhost(meta?.ghost ?? null);
      const peer = meta?.peerScore;
      if (typeof peer === "number") setPeerScore(peer);

      if (meta?.campaign){
        const already = meta.campaignRecorded;
        if (already && meta.campaignResult){
          setCampaignInfo(meta.campaignResult);
          return;
        }
        const passRate = meta.campaign?.boss ? 0.7 : 0.6;
        const passed = total > 0 && acc >= passRate;
        const result = recordCampaignResult({ discipline: meta.campaign.discipline, level: meta.campaign.level, boss: meta.campaign.boss, won: passed });
        if (passed){
          const bonus = meta.campaign?.boss ? 50 : 20;
          awardBonusXp(bonus);
        }
        const campaignResult = { passed, required: Math.round(passRate*100), ...result, boss: meta.campaign?.boss };
        const next = patchSession({ meta: { ...meta, campaignRecorded: true, campaignResult } });
        if (next) setCampaignInfo(campaignResult);
      }
    })();
  }, []);

  useEffect(() => {
    if (!s) return;
    const onlineCode = (s.meta as any)?.onlineCode as string | undefined;
    if (!onlineCode) return;
    return subscribeDuelEvents(onlineCode, (payload) => {
      if (payload.type !== "answer") return;
      const meta = (getSession()?.meta as any) ?? {};
      const peer = Number(meta.peerScore ?? 0) + Number(payload.scoreAdd ?? 0);
      const next = patchSession({ meta: { ...meta, peerScore: peer } });
      if (next) setPeerScore(peer);
    });
  }, []);

  const finish = () => {
    closeDuelChannel();
    clearSession();
    nav("/");
  };

  if (!s) return null;

  const ghostScore = ghost?.score ?? null;
  const verdict = ghostScore == null ? null : (my.score > ghostScore ? "Você venceu!" : my.score < ghostScore ? "Você perdeu." : "Empate!");
  const onlineVerdict = peerScore == null ? null : (my.score > peerScore ? "Você venceu!" : my.score < peerScore ? "Você perdeu." : "Empate!");
  const timeUp = Boolean((s.meta as any)?.timeUp);

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Resultado</div>
      <div className="sub">Resumo rápido.</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div style={{ fontWeight: 900 }}>Acertos</div>
          <div className="h1" style={{ marginTop: 6 }}>{my.ok}/{my.total}</div>
        </div>
        <div className="kpi" style={{ gridColumn:"span 6" }}>
          <div style={{ fontWeight: 900 }}>Pontuação</div>
          <div className="h1" style={{ marginTop: 6 }}>{my.score}</div>
        </div>

        {campaignInfo && (
          <div className="kpi" style={{ gridColumn:"span 12" }}>
            <div style={{ fontWeight: 900 }}>Campanha</div>
            <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
              <span className="pill" style={{ background: campaignInfo.passed ? "rgba(52,211,153,.18)" : "rgba(251,113,133,.18)" }}>
                {campaignInfo.passed ? "Vitória" : "Derrota"}
              </span>
              <span className="pill">Meta: {campaignInfo.required}%</span>
              {campaignInfo.boss && <span className="pill">Boss</span>}
              {campaignInfo.leveledUp && <span className="pill">Fase desbloqueada</span>}
              {campaignInfo.bossUnlocked && <span className="pill">Boss liberado</span>}
              {campaignInfo.bossDefeated && <span className="pill">Boss derrotado</span>}
              {timeUp && <span className="pill" style={{ color:"var(--warn-500)" }}>Tempo esgotado</span>}
            </div>
          </div>
        )}

        {ghostScore != null && (
          <div className="kpi" style={{ gridColumn:"span 12" }}>
            <div style={{ fontWeight: 900 }}>Duelo Fantasma</div>
            <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
              <span className="pill">Você: <b>{my.score}</b></span>
              <span className="pill">Fantasma: <b>{ghostScore}</b> ({ghost.profile})</span>
              <span className="pill" style={{ marginLeft:"auto", background:"rgba(255,255,255,.08)" }}><b>{verdict}</b></span>
            </div>
          </div>
        )}

        {peerScore != null && (
          <div className="kpi" style={{ gridColumn:"span 12" }}>
            <div style={{ fontWeight: 900 }}>Duelo Online</div>
            <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
              <span className="pill">Você: <b>{my.score}</b></span>
              <span className="pill">Oponente: <b>{peerScore}</b></span>
              <span className="pill" style={{ marginLeft:"auto", background:"rgba(255,255,255,.08)" }}><b>{onlineVerdict}</b></span>
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btnPrimary" onClick={finish}>Voltar pra Arena</button>
        <button className="btn" onClick={()=>{ finish(); nav("/revisao"); }}>Ir pra Revisão</button>
      </div>
    </div>
  );
}


