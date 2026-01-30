import React, { useEffect, useMemo, useRef, useState } from "react";
import Wheel from "../components/Wheel";
import { useNavigate } from "react-router-dom";
import { getActiveQuestions } from "../services/packs";
import type { Discipline } from "../types";
import { onlineEnabled } from "../services/online";
import {
  connectRoomChannel,
  createRoomRecord,
  fetchRoomRecord,
  getDuelClientId,
  joinRoomRecord,
  startRoomRecord,
  type DuelRoom,
  type DuelRoomConfig
} from "../services/duelRoom";
import { getAuthUser, onAuthChange } from "../services/auth";

type GhostProfile = "Rápido"|"Preciso"|"Equilibrado";

type OnlineStatus = "idle"|"hosting"|"joining"|"waiting"|"ready";

export default function Duel(){
  const nav = useNavigate();
  const [profile, setProfile] = useState<GhostProfile>("Equilibrado");
  const [picked, setPicked] = useState<Discipline | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState<OnlineStatus>("idle");
  const [config, setConfig] = useState<DuelRoomConfig | null>(null);
  const [mixMode, setMixMode] = useState(true);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const online = onlineEnabled();
  const [authReady, setAuthReady] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const clientId = useMemo(() => getDuelClientId(), []);
  const channelCleanupRef = useRef<null | (()=>void)>(null);
  const startRequestedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const isHost = room?.host_id === clientId;

  const activePool = useMemo(() => getActiveQuestions(), []);
  const availableDisciplines = useMemo(() => {
    const set = new Set(activePool.map(q => q.discipline));
    return Array.from(set.values());
  }, [activePool]);

  const spinPick = (d: Discipline) => {
    setPicked(d);
    setNotice(null);
  };

  useEffect(() => {
    getAuthUser().then((u) => {
      setAuthOk(Boolean(u?.emailConfirmed));
      setAuthReady(true);
    });
    return onAuthChange((u) => {
      setAuthOk(Boolean(u?.emailConfirmed));
      setAuthReady(true);
    });
  }, []);

  const clearRoomTimeout = () => {
    if (timeoutRef.current){
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const armResyncTimeout = (code: string) => {
    clearRoomTimeout();
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const latest = await fetchRoomRecord(code);
        if (latest){
          setRoom(latest);
          if (latest.status === "started" && latest.config){
            nav(`/duelo/jogo?code=${code}`);
          }
        }
      } catch (err: any){
        console.error("[duel] recheck failed", err?.message ?? err);
      }
    }, 12000);
  };

  const startGhost = () => {
    nav(`/duelo/jogo?mode=ghost&ghost=${encodeURIComponent(profile)}`);
  };

  const createRoom = async () => {
    if (!online) return;
    if (!authOk){
      setNotice("Faça login e confirme o email para jogar online.");
      return;
    }
    const chosen = picked ?? availableDisciplines[Math.floor(Math.random() * availableDisciplines.length)];
    if (!chosen){
      setNotice("Sem disciplinas ativas.");
      return;
    }
    const code = makeRoomCode();
    const seed = hashString(code + chosen);
    const length = 12;
    setRoomCode(code);
    const cfg: DuelRoomConfig = { discipline: chosen, seed, length, mix: mixMode };
    setConfig(cfg);
    setStatus("hosting");
    setNotice(null);
    setRoom(null);
    startRequestedRef.current = false;
    try {
      channelCleanupRef.current?.();
      const channel = await connectRoomChannel(code, (next) => setRoom(next));
      await channel.waitForSubscribed();
      channelCleanupRef.current = channel.unsubscribe;
      await createRoomRecord(code, cfg, clientId);
      armResyncTimeout(code);
    } catch (err: any){
      console.error("[duel] create room failed", err?.message ?? err);
      setNotice("Falha ao criar sala online. Verifique as chaves do Supabase.");
    }
  };

  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    if (!online) return;
    if (!authOk){
      setNotice("Faça login e confirme o email para jogar online.");
      return;
    }
    setRoomCode(code);
    setStatus("joining");
    setNotice(null);
    setRoom(null);
    startRequestedRef.current = false;
    try {
      channelCleanupRef.current?.();
      const channel = await connectRoomChannel(code, (next) => setRoom(next));
      await channel.waitForSubscribed();
      channelCleanupRef.current = channel.unsubscribe;
      const existing = await fetchRoomRecord(code);
      if (!existing){
        setNotice("Sala não encontrada. Verifique o código.");
        setStatus("idle");
        return;
      }
      setConfig(existing.config);
      setPicked(existing.config?.discipline ?? null);
      if (existing.status === "started"){
        nav(`/duelo/jogo?code=${code}`);
        setStatus("ready");
        return;
      }
      await joinRoomRecord(code, clientId);
      armResyncTimeout(code);
    } catch (err: any){
      console.error("[duel] join room failed", err?.message ?? err);
      setNotice("Falha ao entrar na sala. Verifique o código e a conexão.");
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (!room) return;
    if (room.config){
      setConfig(room.config);
      setPicked(room.config.discipline);
    }
    if (room.status === "waiting"){
      setStatus(isHost ? "hosting" : "waiting");
    } else if (room.status === "ready"){
      setStatus(isHost ? "hosting" : "waiting");
    } else if (room.status === "started"){
      setStatus("ready");
      nav(`/duelo/jogo?code=${room.code}`);
    }
  }, [room, nav, isHost]);

  useEffect(() => {
    if (!room || !config) return;
    if (room.status === "ready" && isHost && !startRequestedRef.current){
      startRequestedRef.current = true;
      startRoomRecord(room.code).catch((err: any) => {
        console.error("[duel] start room failed", err?.message ?? err);
        startRequestedRef.current = false;
      });
    }
  }, [room, config, isHost]);

  const startNow = async () => {
    if (!room || !isHost) return;
    try {
      startRequestedRef.current = true;
      await startRoomRecord(room.code);
    } catch (err: any){
      console.error("[duel] start room failed", err?.message ?? err);
      startRequestedRef.current = false;
      setNotice("Falha ao iniciar. Tente novamente.");
    }
  };

  useEffect(() => {
    return () => {
      channelCleanupRef.current?.();
      clearRoomTimeout();
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Duelo</div>
      <div className="sub">Local: contra fantasma. Online: sala por código (Supabase).</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Roleta do Duelo</div>
          <div className="sub">Gire para sortear o foco da rodada. No modo misto, a roleta gira a cada questão.</div>
          <div style={{ marginTop: 10 }}>
            <Wheel onPick={spinPick} disciplines={availableDisciplines} disabled={!availableDisciplines.length} />
          </div>
          {!availableDisciplines.length && (
            <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>
              Sem disciplinas ativas. Ative packs no Perfil.
            </div>
          )}
          {picked && (
            <div className="pill" style={{ marginTop: 10 }}>Disciplina sorteada: <b>{picked}</b></div>
          )}
          <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
            <span className="sub" style={{ marginRight: 6 }}>Modo:</span>
            <button
              className="btn"
              onClick={()=>setMixMode(true)}
              style={{ background: mixMode ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}
            >
              Misto (roleta por questão)
            </button>
            <button
              className="btn"
              onClick={()=>setMixMode(false)}
              style={{ background: !mixMode ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}
            >
              Foco na disciplina
            </button>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Duelo Fantasma</div>
          <div className="sub">Pontuação: acerto (100) + bônus por tempo. Oponente simulado.</div>

          <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
            {(["Rápido","Preciso","Equilibrado"] as const).map(p => (
              <button
                key={p}
                className="btn"
                style={{ background: profile===p ? "rgba(20,160,255,.20)" : "rgba(255,255,255,.06)" }}
                onClick={()=>setProfile(p)}
              >
                {p}
              </button>
            ))}
            <button className="btn btnPrimary" onClick={startGhost} style={{ marginLeft:"auto" }}>
              Começar
            </button>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Duelo Online (sem custo)</div>
          <div className="sub">
            {online
              ? "Crie uma sala e envie o código para seu amigo."
              : "Desativado: configure .env (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)."}
          </div>

          {online && (
            <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
              {!authOk && authReady && (
                <div className="pill" style={{ color:"var(--warn-500)" }}>Login com email confirmado é obrigatório.</div>
              )}
              <div className="row" style={{ flexWrap:"wrap" }}>
                <button className="btn" onClick={createRoom} disabled={!authOk}>Criar sala</button>
                <input
                  className="input"
                  style={{ maxWidth: 220 }}
                  value={roomCode}
                  placeholder="Código da sala"
                  onChange={(e)=>setRoomCode(e.target.value.toUpperCase())}
                />
                <button className="btn btnPrimary" onClick={joinRoom} disabled={!authOk}>Entrar</button>
              </div>
              {roomCode && (
                <div className="pill">Sala: <b>{roomCode}</b> • Status: {status}</div>
              )}
              {room && isHost && room.status !== "started" && (
                <div className="row" style={{ justifyContent:"flex-end" }}>
                  <button className="btn btnPrimary" onClick={startNow} disabled={startRequestedRef.current}>
                    {startRequestedRef.current ? "Iniciando..." : "Iniciar duelo"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="pill" style={{ marginTop: 12, color:"var(--warn-500)" }}>{notice}</div>
      )}
    </div>
  );
}

function makeRoomCode(){
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function hashString(input: string){
  let h = 2166136261;
  for (let i=0;i<input.length;i++){
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
