import React, { useEffect, useMemo, useRef, useState } from "react";
import Wheel from "../components/Wheel";
import { newSession } from "../services/session";
import { useNavigate } from "react-router-dom";
import { getActiveQuestions, getAllQuestions } from "../services/packs";
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
  const clientId = useMemo(() => getDuelClientId(), []);
  const channelCleanupRef = useRef<null | (()=>void)>(null);
  const startedRef = useRef(false);
  const startRequestedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const isHost = room?.host_id === clientId;

  const activePool = useMemo(() => getActiveQuestions(), []);
  const fullPool = useMemo(() => getAllQuestions(), []);
  const availableDisciplines = useMemo(() => {
    const set = new Set(activePool.map(q => q.discipline));
    return Array.from(set.values());
  }, [activePool]);

  const spinPick = (d: Discipline) => {
    setPicked(d);
    setNotice(null);
  };

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
            startOnlineMatch(latest.config, code, fullPool, nav, startedRef);
          }
        }
      } catch (err: any){
        console.error("[duel] recheck failed", err?.message ?? err);
      }
    }, 12000);
  };

  const startGhost = () => {
    if (!picked){
      setNotice("Gire a roleta para sortear a disciplina.");
      return;
    }
    const queue = buildQueue(activePool, picked, 10, undefined, mixMode);
    if (!queue.length){
      setNotice("Sem questões ativas para essa disciplina.");
      return;
    }
    const ghost = makeGhost(profile, queue.length);
    const modeLabel = mixMode ? "Misto" : "Foco";
    newSession("duel", queue, { discipline: picked, label: `Duelo • ${modeLabel} • Fantasma (${profile}) • ${picked}` }, { ghost, mixMode });
    nav("/questao");
  };

  const createRoom = async () => {
    if (!picked){
      setNotice("Gire a roleta antes de criar a sala.");
      return;
    }
    if (!online) return;
    const code = makeRoomCode();
    const seed = hashString(code + picked);
    const length = 12;
    setRoomCode(code);
    const cfg: DuelRoomConfig = { discipline: picked, seed, length, mix: mixMode };
    setConfig(cfg);
    setStatus("hosting");
    setNotice(null);
    setRoom(null);
    startedRef.current = false;
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
    setRoomCode(code);
    setStatus("joining");
    setNotice(null);
    setRoom(null);
    startedRef.current = false;
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
        startOnlineMatch(existing.config, code, fullPool, nav, startedRef);
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
      if (room.config){
        startOnlineMatch(room.config, room.code, fullPool, nav, startedRef);
      }
    }
  }, [room, fullPool, nav, isHost]);

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
              <div className="row" style={{ flexWrap:"wrap" }}>
                <button className="btn" onClick={createRoom}>Criar sala</button>
                <input
                  className="input"
                  style={{ maxWidth: 220 }}
                  value={roomCode}
                  placeholder="Código da sala"
                  onChange={(e)=>setRoomCode(e.target.value.toUpperCase())}
                />
                <button className="btn btnPrimary" onClick={joinRoom}>Entrar</button>
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

function makeGhost(profile: GhostProfile, n: number){
  const baseAcc = profile === "Preciso" ? 0.80 : profile === "Rápido" ? 0.62 : 0.72;
  const baseTime = profile === "Rápido" ? 5500 : profile === "Preciso" ? 9800 : 7600;

  let score = 0;
  const perQ: { isCorrect: boolean; timeSpentMs: number }[] = [];
  for (let i=0;i<n;i++){
    const isCorrect = Math.random() < baseAcc;
    const timeSpentMs = Math.round(baseTime * (0.7 + Math.random()*0.8));
    const bonus = Math.max(0, Math.round((12000 - timeSpentMs) / 600));
    score += (isCorrect ? 100 : 0) + (isCorrect ? bonus : 0);
    perQ.push({ isCorrect, timeSpentMs });
  }
  return { profile, score, perQ };
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

function mulberry32(seed: number){
  return function(){
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(arr: T[], seed: number): T[]{
  const rng = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shuffleWithRng<T>(arr: T[], rng: ()=>number): T[]{
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickUnique<T>(arr: T[], n: number, rng: ()=>number): T[]{
  return shuffleWithRng(arr, rng).slice(0, Math.min(n, arr.length));
}

function buildQueue(
  pool: { id: string; discipline: Discipline }[],
  discipline: Discipline,
  length: number,
  seed?: number,
  mixMode = false
){
  if (!pool.length) return [];
  if (!mixMode){
    const filtered = pool.filter(q => q.discipline === discipline);
    if (!filtered.length) return [];
    const list = seed != null ? shuffleSeeded(filtered, seed) : [...filtered].sort(()=>Math.random()-0.5);
    return list.slice(0, length).map(q => q.id);
  }

  const rng = seed != null ? mulberry32(seed) : Math.random;
  const focus = pool.filter(q => q.discipline === discipline);
  const others = pool.filter(q => q.discipline !== discipline);
  const focusTarget = Math.min(focus.length, Math.max(0, Math.round(length * 0.6)));
  const otherTarget = Math.min(others.length, Math.max(0, length - focusTarget));
  const picked = [...pickUnique(focus, focusTarget, rng), ...pickUnique(others, otherTarget, rng)];
  const pickedIds = new Set(picked.map(q => q.id));
  const remaining = pool.filter(q => !pickedIds.has(q.id));
  while (picked.length < length && remaining.length){
    const next = pickUnique(remaining, 1, rng)[0];
    if (!next) break;
    picked.push(next);
    pickedIds.add(next.id);
  }
  const final = shuffleWithRng(picked, rng);
  return final.slice(0, length).map(q => q.id);
}

function startOnlineMatch(
  config: DuelRoomConfig,
  code: string,
  pool: { id: string; discipline: Discipline }[],
  nav: (path: string)=>void,
  startedRef: React.MutableRefObject<boolean>
){
  if (startedRef.current) return;
  startedRef.current = true;
  const queue = buildQueue(pool, config.discipline, config.length, config.seed, config.mix);
  const modeLabel = config.mix ? "Misto" : "Foco";
  newSession(
    "duel",
    queue,
    { discipline: config.discipline, label: `Duelo • ${modeLabel} • Online • ${config.discipline}` },
    { onlineCode: code, myScore: 0, peerScore: 0, mixMode: config.mix }
  );
  nav("/questao");
}
