import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QuestionView from "../components/QuestionView";
import Wheel from "../components/Wheel";
import { getActiveQuestions, blockQuestion } from "../services/packs";
import { getDuelClientId, updateRoomState, fetchRoomRecord, connectRoomChannel, startRoomRecord, type DuelRoom, type DuelState } from "../services/duelRoom";
import type { Discipline, Question } from "../types";
import { awardAttemptXP } from "../services/progress";
import { uid } from "../lib/uid";
import { putAttempt } from "../services/db";
import { DISCIPLINES } from "../data/disciplines";
import { sfx, useSfxEnabled } from "../services/sfx";
import { useQuestionOverridesVersion } from "../hooks/useQuestionOverrides";

type Role = "host" | "guest";
type PowerType = "bomb" | "extraTime" | "skip" | "double";

const BASE_TIME_MS = 90000;

export default function DuelMatch(){
  const nav = useNavigate();
  const [params] = useSearchParams();
  const code = params.get("code")?.toUpperCase() ?? "";
  const mode = params.get("mode") ?? (code ? "online" : "ghost");
  const ghostProfile = params.get("ghost") ?? "Equilibrado";
  const resumeKey = "rota190:lastRoomCode";
  const roomsKey = "rota190:rooms";
  const safeGet = (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const safeSet = (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch {}
  };
  const safeRemove = (key: string) => {
    try { localStorage.removeItem(key); } catch {}
  };

  const clientId = useMemo(() => getDuelClientId(), []);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [localState, setLocalState] = useState<DuelState | null>(null);
  const [localWinner, setLocalWinner] = useState<Role | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [spinOpen, setSpinOpen] = useState(false);
  const [crownNotice, setCrownNotice] = useState<string | null>(null);
  const pendingSpinRef = useRef<{ base: DuelState } | null>(null);
  const [attemptToken, setAttemptToken] = useState(0);
  const [hiddenKeys, setHiddenKeys] = useState<Array<"A"|"B"|"C"|"D"|"E">>([]);
  const [extraTime, setExtraTime] = useState(0);
  const [doubleChance, setDoubleChance] = useState(false);
  const [retryUsed, setRetryUsed] = useState(false);
  const awaitingGhostRef = useRef(false);
  const lastTurnRef = useRef<"none"|"turn"|"crown">("none");
  const crownCountRef = useRef(0);
  const { enabled: sfxEnabled, toggle: toggleSfx } = useSfxEnabled();
  const winSfxRef = useRef(false);
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    return Notification.permission === "granted";
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [crownAnim, setCrownAnim] = useState(false);
  const [reveal, setReveal] = useState<{ q: Question; correct: boolean; selectedKey: string } | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const overridesVersion = useQuestionOverridesVersion();

  const activePool = useMemo(() => getActiveQuestions().filter(q => q.hasAnswer !== false), [overridesVersion]);
  const questionMap = useMemo(() => new Map(activePool.map(q => [q.id, q])), [activePool]);
  const matchDisciplines = useMemo(() => {
    const set = new Set(activePool.map(q => q.discipline));
    return set.size ? Array.from(set.values()) : DISCIPLINES;
  }, [activePool]);

  const isOnline = mode === "online";
  const me: Role = isOnline ? (room?.host_id === clientId ? "host" : "guest") : "host";
  const opponent: Role = me === "host" ? "guest" : "host";

  const state = isOnline ? room?.state ?? null : localState;
  const current = state?.current;
  const currentQ = current?.questionId ? questionMap.get(current.questionId) ?? null : null;
  const myTurn = state?.turn === me;
  const myQuestion = current?.player === me;
  const winnerId = isOnline ? room?.winner_id ?? null : null;
  const stats = state?.stats ?? { host: { correct: 0, total: 0 }, guest: { correct: 0, total: 0 } };
  const chat = state?.chat ?? [];
  const availableDisciplines = useMemo(() => {
    return matchDisciplines.length ? matchDisciplines : DISCIPLINES;
  }, [matchDisciplines]);

  const addRoomToList = (roomCode: string) => {
    const raw = safeGet(roomsKey);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [roomCode, ...list.filter((c) => c !== roomCode)].slice(0, 8);
    safeSet(roomsKey, JSON.stringify(next));
  };

  const removeRoomFromList = (roomCode: string) => {
    const raw = safeGet(roomsKey);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = list.filter((c) => c !== roomCode);
    safeSet(roomsKey, JSON.stringify(next));
  };

  const requestNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotifyEnabled(permission === "granted");
    } catch {
      setNotifyEnabled(false);
    }
  };

  const safeNotify = (title: string, body: string) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body });
    } catch {
      // Some mobile browsers block Notification constructor
    }
  };

  useEffect(() => {
    if (!code && params.get("mode") == null){
      const saved = safeGet(resumeKey);
      if (saved){
        nav(`/duelo/jogo?code=${saved}`);
      }
    }
  }, [code]);

  useEffect(() => {
    if (!isOnline){
      if (!localState){
        setLocalState(initialLocalState(matchDisciplines));
      }
      return;
    }
    if (!code) return;
    let cleanup: null | (()=>void) = null;
    (async () => {
      try {
        setLoadError(null);
        const channel = await connectRoomChannel(code, (next) => setRoom(next));
        await channel.waitForSubscribed();
        cleanup = channel.unsubscribe;
        const latest = await fetchRoomRecord(code);
        if (latest) setRoom(latest);
        if (!latest){
          setLoadError("Sala nÃÂ£o encontrada ou expirada.");
        }
        if (latest?.code) safeSet(resumeKey, latest.code);
        if (latest?.code) addRoomToList(latest.code);
      } catch (err: any){
        console.error("[duel] connect failed", err?.message ?? err);
        setNotice("Falha ao conectar na sala.");
        setLoadError("Falha ao conectar. Verifique sua internet e tente novamente.");
      }
    })();
    return () => cleanup?.();
  }, [isOnline, code]);

  useEffect(() => {
    if (!isOnline || !code) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const latest = await fetchRoomRecord(code);
        if (latest) setRoom(latest);
      } catch {
        // ignore, realtime will still handle
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [isOnline, code]);

  useEffect(() => {
    if (!isOnline || !room) return;
    if (room.status === "ended"){
      safeRemove(resumeKey);
      removeRoomFromList(room.code);
      return;
    }
    safeSet(resumeKey, room.code);
    addRoomToList(room.code);
  }, [isOnline, room?.code, room?.status]);

  useEffect(() => {
    if (!isOnline || !state) return;
    const isMyTurn = state.turn === me && !state.current && !state.pendingCrown;
    const isMyCrown = state.pendingCrown?.player === me;
    if (isMyTurn && lastTurnRef.current !== "turn" && sfxEnabled){
      sfx.turn();
    }
    if (isMyTurn && lastTurnRef.current !== "turn"){
      safeNotify("Sua vez no duelo", "Gire a roleta para continuar.");
      lastTurnRef.current = "turn";
    } else if (isMyCrown && lastTurnRef.current !== "crown"){
      safeNotify("Coroa disponÃÂ­vel!", "Escolha a categoria para disputar a coroa.");
      lastTurnRef.current = "crown";
    } else if (!isMyTurn && !isMyCrown) {
      lastTurnRef.current = "none";
    }
  }, [isOnline, state?.turn, state?.current, state?.pendingCrown?.player, me, sfxEnabled]);

  useEffect(() => {
    if (!state) return;
    const count = countCrowns(state, me);
    if (count > crownCountRef.current){
      setCrownAnim(true);
      if (sfxEnabled) sfx.crown();
      window.setTimeout(() => setCrownAnim(false), 1600);
    }
    crownCountRef.current = count;
  }, [state?.crowns, sfxEnabled, me]);

  useEffect(() => {
    if (!isOnline || !room) return;
    if (room.state) return;
    const init = initialLocalState(matchDisciplines);
    updateRoomState(room.code, init, room.version).then((next) => setRoom(next)).catch((err: any) => {
      console.error("[duel] init state failed", err?.message ?? err);
    });
  }, [isOnline, room?.code, room?.version, room?.state]);

  useEffect(() => {
    if (!isOnline || !room?.state) return;
    const st = room.state;
    if (st.stats && st.bags && st.recent && st.chat) return;
    const patched: DuelState = {
      ...st,
      stats: st.stats ?? { host: { correct: 0, total: 0 }, guest: { correct: 0, total: 0 } },
      bags: st.bags ?? { host: [], guest: [] },
      recent: st.recent ?? { host: [], guest: [] },
      chat: st.chat ?? []
    };
    updateRoomState(room.code, patched, room.version).then((next) => setRoom(next)).catch(() => {});
  }, [isOnline, room?.state]);

  useEffect(() => {
    if (!isOnline || !room?.state || room.winner_id) return;
    const winner = nextWinner(room.state, room, me, clientId);
    if (!winner) return;
    updateRoomState(room.code, room.state, room.version, winner)
      .then((next) => setRoom(next))
      .catch(() => {});
  }, [isOnline, room?.state, room?.winner_id, room?.version, me, clientId]);

  useEffect(() => {
    if (!currentQ) return;
    setHiddenKeys([]);
    setExtraTime(0);
    setDoubleChance(false);
    setRetryUsed(false);
    setAttemptToken((t) => t + 1);
  }, [currentQ?.id]);

  const ensureState = () => {
    if (!state) throw new Error("Estado do duelo ausente.");
    return state;
  };

  useEffect(() => {
    if (!state) return;
    const desired = matchDisciplines.length ? matchDisciplines : DISCIPLINES;
    const currentList = state.disciplines?.length ? state.disciplines : Object.keys(state.crowns) as Discipline[];
    const same =
      currentList.length === desired.length &&
      currentList.every((d) => desired.includes(d));
    if (same) return;
    const nextCrowns = {} as DuelState["crowns"];
    desired.forEach((d) => {
      nextCrowns[d] = state.crowns[d] ?? { host: false, guest: false };
    });
    const patched: DuelState = { ...state, disciplines: desired, crowns: nextCrowns };
    if (!isOnline){
      setLocalState(patched);
      return;
    }
    if (!room) return;
    updateRoomState(room.code, patched, room.version).then((next) => setRoom(next)).catch(() => {});
  }, [state?.crowns, state?.disciplines, matchDisciplines, isOnline, room?.code, room?.version]);

  const updateState = async (next: DuelState) => {
    if (!isOnline){
      setLocalState(next);
      return;
    }
    if (!room) return;
    try {
      const updated = await updateRoomState(room.code, next, room.version, nextWinner(next, room, me, clientId));
      setRoom(updated);
    } catch (err: any){
      console.error("[duel] state update failed", err?.message ?? err);
      const latest = await fetchRoomRecord(room.code);
      if (latest) setRoom(latest);
    }
  };

  const sendChat = async () => {
    if (!isOnline || !state || !room) return;
    const text = chatText.trim();
    if (!text) return;
    const message = { id: uid("msg"), role: me, text: text.slice(0, 220), at: Date.now() };
    const nextChat = [...(state.chat ?? []), message].slice(-30);
    setChatText("");
    try {
      await updateState({ ...state, chat: nextChat });
    } catch (err){
      try {
        const latest = await fetchRoomRecord(room.code);
        if (latest?.state){
          const merged = [...(latest.state.chat ?? []), message].slice(-30);
          await updateState({ ...latest.state, chat: merged });
        }
      } catch {}
    }
  };

  const handleSpin = () => {
    if (!state) return;
    if (!myTurn || current) return;
    if (state.pendingCrown?.player === me){
      return;
    }
    pendingSpinRef.current = { base: state };
    setSpinOpen(true);
    if (sfxEnabled) sfx.spin();
  };

  const startQuestion = async (category: Discipline, crown: boolean, base?: DuelState) => {
    const s = base ?? ensureState();
    const used = new Set(s.used);
    const picked = pickQuestion(activePool, used, category);
    if (!picked){
      setNotice("Sem questÃÂµes disponÃÂ­veis.");
      return;
    }
    used.add(picked.id);
    const recentBase = s.recent ?? { host: [], guest: [] };
    const nextRecent = [...(recentBase[s.turn] ?? []), picked.discipline].slice(-3);
    const next: DuelState = {
      ...s,
      current: { questionId: picked.id, category: picked.discipline, crown, player: s.turn },
      used: Array.from(used),
      pendingCrown: undefined,
      recent: { ...recentBase, [s.turn]: nextRecent }
    };
    const winnerRole = !isOnline ? localWinnerFromState(next) : null;
    if (winnerRole) setLocalWinner(winnerRole);
    await updateState(next);
  };

  const onWheelPick = async (category: Discipline) => {
    setSpinOpen(false);
    if (!state) return;
    const base = pendingSpinRef.current?.base ?? state;
    await startQuestion(category, false, base);
  };

  const onWheelCrown = async () => {
    setSpinOpen(false);
    if (!state) return;
    const base = pendingSpinRef.current?.base ?? state;
    const unowned = unownedCategories(base, base.turn);
    if (!unowned.length){
      await startQuestion(base.recent?.[base.turn]?.slice(-1)[0] ?? matchDisciplines[0] ?? "PortuguÃÂªs", false, base);
      return;
    }
    const next: DuelState = { ...base, pendingCrown: { player: base.turn, reason: "wheel" } };
    await updateState(next);
    setCrownNotice("Coroa direta! Escolha a categoria.");
    if (sfxEnabled) sfx.crown();
    window.setTimeout(() => setCrownNotice(null), 2200);
  };

  const selectCrownCategory = async (category: Discipline) => {
    if (!state) return;
    if (state.pendingCrown?.player !== me) return;
    if (state.crowns[category]?.[me]) return;
    await startQuestion(category, true, state);
  };

  const applyPower = async (type: PowerType) => {
    if (!state || !current || !myQuestion) return;
    const inv = state.powers[me];
    if (inv[type] <= 0) return;
    const nextPowers = { ...state.powers, [me]: { ...inv, [type]: inv[type] - 1 } };
    const nextState = { ...state, powers: nextPowers };
    if (type === "bomb" && currentQ){
      await updateState(nextState);
      const wrongKeys = currentQ.options.map(o => o.key).filter(k => k !== currentQ.correctKey);
      const bombed = shuffle(wrongKeys).slice(0, 2);
      setHiddenKeys(bombed);
      if (sfxEnabled) sfx.power();
    }
    if (type === "extraTime"){
      await updateState(nextState);
      setExtraTime(15000);
      if (sfxEnabled) sfx.power();
    }
    if (type === "double"){
      await updateState(nextState);
      setDoubleChance(true);
      if (sfxEnabled) sfx.power();
    }
    if (type === "skip"){
      await skipCurrentQuestion(nextState);
    }
  };

  const skipCurrentQuestion = async (base?: DuelState) => {
    const source = base ?? state;
    if (!source || !current) return;
    const next: DuelState = {
      ...source,
      current: undefined,
      pendingCrown: source.pendingCrown?.player === source.turn ? undefined : source.pendingCrown
    };
    await updateState(next);
  };

  const resolveAnswer = async (isCorrect: boolean, selectedKey: string, timeSpentMs: number, skipped = false, baseState?: DuelState) => {
    const source = baseState ?? state;
    if (!source || !current || !currentQ) return;
    const next = { ...source };
    const player = current.player;
    const opponent: Role = player === "host" ? "guest" : "host";

    if (!skipped){
      await putAttempt({
        id: uid("att"),
        questionId: currentQ.id,
        createdAt: Date.now(),
        mode: "duel",
        selectedKey,
        isCorrect,
        timeSpentMs,
        markedForReview: false,
        flagged: false
      });
    }

    if (isCorrect){
      next.streak = { ...next.streak, [player]: next.streak[player] + 1 };
      if (current.crown){
        const baseCrowns = next.crowns[current.category] ?? { host: false, guest: false };
        next.crowns = {
          ...next.crowns,
          [current.category]: { ...baseCrowns, [player]: true }
        };
        next.streak = { ...next.streak, [player]: 0 };
      }
      if (next.streak[player] >= 3){
        const unowned = unownedCategories(next, player);
        if (unowned.length){
          next.pendingCrown = { player, reason: "streak" };
          next.streak = { ...next.streak, [player]: 0 };
          if (sfxEnabled) sfx.crown();
        }
      }
    } else {
      next.streak = { ...next.streak, [player]: 0 };
      next.turn = opponent;
    }

    const baseStats = next.stats ?? { host: { correct: 0, total: 0 }, guest: { correct: 0, total: 0 } };
    next.stats = {
      ...baseStats,
      [player]: {
        correct: baseStats[player].correct + (isCorrect ? 1 : 0),
        total: baseStats[player].total + 1
      }
    };

    next.current = undefined;

    if (!skipped) awardAttemptXP({ isCorrect, timeSpentMs });
    if (!skipped && sfxEnabled){
      isCorrect ? sfx.correct() : sfx.wrong();
    }
    if (!isOnline){
      const winnerRole = localWinnerFromState(next);
      if (winnerRole) setLocalWinner(winnerRole);
    }
    await updateState(next);
  };

  const onSubmit = async ({ selectedKey, timeSpentMs }: { selectedKey: string; timeSpentMs: number }) => {
    if (!state || !currentQ || !current) return { isCorrect: false };
    if (currentQ.hasAnswer === false){
      return { isCorrect: true };
    }
    const chosen = selectedKey || "TIMEOUT";
    const isCorrect = chosen === currentQ.correctKey;

    if (doubleChance && !retryUsed && !isCorrect){
      setRetryUsed(true);
      return { isCorrect: false, retry: true };
    }

    await resolveAnswer(isCorrect, chosen, timeSpentMs);
    setReveal({ q: currentQ, correct: isCorrect, selectedKey: chosen });
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => setReveal(null), 1800);
    return { isCorrect };
  };

  useEffect(() => {
    if (mode !== "ghost") return;
    if (!state || state.turn !== "guest" || state.current) return;
    if (awaitingGhostRef.current) return;
    awaitingGhostRef.current = true;
    const delay = 900 + Math.random() * 800;
    window.setTimeout(async () => {
      awaitingGhostRef.current = false;
      if (state.pendingCrown?.player === "guest"){
        const unowned = unownedCategories(state, "guest");
        const pick = unowned[Math.floor(Math.random() * unowned.length)];
        if (pick){
          await startQuestion(pick, true, state);
        }
        return;
      }
      const prepared = prepareSpin(state, "guest", activePool, matchDisciplines);
      pendingSpinRef.current = { base: prepared.base };
      await startQuestion(prepared.category, false, prepared.base);
    }, delay);
  }, [mode, state?.turn, state?.current, matchDisciplines, activePool]);

  useEffect(() => {
    if (mode !== "ghost") return;
    if (!state || !current || current.player !== "guest") return;
    const accuracy = ghostProfile === "Preciso" ? 0.82 : ghostProfile === "RÃÂ¡pido" ? 0.6 : 0.7;
    const timeMs = ghostProfile === "RÃÂ¡pido" ? 4000 : ghostProfile === "Preciso" ? 8000 : 6000;
    const delay = timeMs * (0.7 + Math.random() * 0.6);
    const id = window.setTimeout(async () => {
      const isCorrect = Math.random() < accuracy;
      const key = isCorrect ? currentQ?.correctKey ?? "A" : pickWrongKey(currentQ);
      await resolveAnswer(isCorrect, key ?? "A", Math.round(delay));
    }, delay);
    return () => window.clearTimeout(id);
  }, [mode, current?.questionId, current?.player]);

  const skipNullQuestion = async () => {
    if (!state || !current) return;
    const blockId = currentQ?.id ?? current.questionId;
    if (blockId){
      blockQuestion(blockId);
    }
    const next: DuelState = {
      ...state,
      current: undefined,
      pendingCrown: state.pendingCrown?.player === state.turn ? undefined : state.pendingCrown
    };
    await updateState(next);
  };

  if (!state){
    if (loadError){
      return (
        <div style={{ padding: 16 }}>
          <div className="h2">NÃÂ£o foi possÃÂ­vel carregar a sala</div>
          <div className="sub">{loadError}</div>
          <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
            <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
            <button className="btn" onClick={() => nav(`/duelo/jogo?code=${code}`)}>Tentar novamente</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: 16 }}>
        <div className="h3">Carregando duelo...</div>
      </div>
    );
  }

  if (!activePool.length){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Sem questÃÂµes ativas</div>
        <div className="sub">Ative packs no Perfil para iniciar o duelo.</div>
        <button className="btn btnPrimary" onClick={() => nav("/perfil")}>Ir para Perfil</button>
      </div>
    );
  }

  if (current && !currentQ){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">QuestÃÂÃÂ£o invÃÂÃÂ¡lida</div>
        <div className="sub">Essa questÃÂÃÂ£o veio sem texto ou com erro. VocÃÂÃÂª pode pular e ela serÃÂÃÂ¡ removida do banco local.</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" onClick={skipNullQuestion}>Pular questÃÂÃÂ£o nula</button>
          <button className="btn" onClick={() => nav("/duelo")}>Voltar</button>
        </div>
      </div>
    );
  }

  if (isOnline && room && room.status !== "started"){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Aguardando inÃÂ­cio</div>
        <div className="sub">A sala ainda nÃÂ£o iniciou a partida. Aguarde o host iniciar.</div>
        <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
          {room.host_id === clientId && (
            <button className="btn btnPrimary" onClick={async () => {
              try {
                await startRoomRecord(room.code);
              } catch (err: any){
                console.error("[duel] start room failed", err?.message ?? err);
                setNotice("Falha ao iniciar a sala.");
              }
            }}>Iniciar agora</button>
          )}
          <button className="btn" onClick={() => nav("/duelo")}>Voltar</button>
        </div>
      </div>
    );
  }

  if (winnerId){
    if (sfxEnabled && !winSfxRef.current){
      winSfxRef.current = true;
      sfx.win();
    }
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Duelo encerrado</div>
        <div className="sub">Vencedor: {winnerId === clientId ? "VocÃÂª" : "Oponente"}</div>
        <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
      </div>
    );
  }
  if (!isOnline && localWinner){
    if (sfxEnabled && !winSfxRef.current){
      winSfxRef.current = true;
      sfx.win();
    }
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Duelo encerrado</div>
        <div className="sub">Vencedor: {localWinner === "host" ? "VocÃÂª" : "Fantasma"}</div>
        <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div className="h2">Duelo</div>
          <div className="sub">Quem errar passa a vez. 3 acertos = coroa. Coroa sÃÂ³ se ganha acertando.</div>
        </div>
        <div className="row">
          {"Notification" in window && (
            <button className="btn" onClick={requestNotification} disabled={notifyEnabled}>
              {notifyEnabled ? "NotificaÃÂ§ÃÂµes: ligadas" : "Ativar notificaÃÂ§ÃÂµes"}
            </button>
          )}
          <button className="btn" onClick={toggleSfx}>{sfxEnabled ? "Som: ligado" : "Som: desligado"}</button>
          <button className="btn" onClick={() => nav("/duelo")}>Sair</button>
        </div>
      </div>

      <div className="sep" />

      {crownAnim && (
        <div className="crownBurst">
          <div className="crownBadge">Ã°ÂÂÂ</div>
          <div className="crownText">Coroa conquistada!</div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns:"repeat(12,1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Placar</div>
          <div className="row" style={{ marginTop: 8, flexWrap:"wrap", gap: 10 }}>
            <Pill label="Turno" value={state.turn === me ? "Sua vez" : "Oponente"} />
            <Pill label="Streak" value={state.streak[me]} />
            <Pill label="Coroas" value={countCrowns(state, me) + "/" + matchDisciplines.length} />
            <Pill label="Coroas oponente" value={countCrowns(state, opponent) + "/" + matchDisciplines.length} />
            <Pill label="Seus acertos" value={`${stats[me].correct}/${stats[me].total}`} />
            <Pill label="Oponente" value={`${stats[opponent].correct}/${stats[opponent].total}`} />
          </div>
          <div style={{ marginTop: 8, display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px,1fr))", gap: 8 }}>
            <div>
              <div className="sub" style={{ marginBottom: 6 }}>Suas coroas</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px,1fr))", gap: 6 }}>
                {matchDisciplines.map(d => (
                  <div key={d} className="pill" style={{ display:"flex", justifyContent:"space-between" }}>
                    <span>{d}</span>
                    <span style={{ color: state.crowns[d]?.[me] ? "var(--ok-500)" : "var(--ink-500)" }}>
                      {state.crowns[d]?.[me] ? "Ã¢ÂÂ" : "Ã¢ÂÂ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="sub" style={{ marginBottom: 6 }}>Coroas do oponente</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px,1fr))", gap: 6 }}>
                {matchDisciplines.map(d => (
                  <div key={d} className="pill" style={{ display:"flex", justifyContent:"space-between" }}>
                    <span>{d}</span>
                    <span style={{ color: state.crowns[d]?.[opponent] ? "var(--warn-500)" : "var(--ink-500)" }}>
                      {state.crowns[d]?.[opponent] ? "Ã¢ÂÂ" : "Ã¢ÂÂ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Poderes</div>
          <div className="sub">Bombas removem 2 alternativas, +tempo adiciona 15s, pular descarta a questÃÂ£o, dupla chance dÃÂ¡ 2 tentativas.</div>
          <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
            <PowerBtn icon="Ã°ÂÂÂ£" label="Bomba" count={state.powers[me].bomb} onClick={() => applyPower("bomb")} disabled={!myQuestion} />
            <PowerBtn icon="Ã¢ÂÂ±" label="+Tempo" count={state.powers[me].extraTime} onClick={() => applyPower("extraTime")} disabled={!myQuestion} />
            <PowerBtn icon="Ã¢ÂÂ­" label="Pular" count={state.powers[me].skip} onClick={() => applyPower("skip")} disabled={!myQuestion} />
            <PowerBtn icon="Ã°ÂÂÂ¯" label="Dupla" count={state.powers[me].double} onClick={() => applyPower("double")} disabled={!myQuestion} />
          </div>
        </div>
      </div>

      {notice && <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>{notice}</div>}
      {crownNotice && <div className="pill" style={{ marginTop: 10, color:"var(--accent-500)", boxShadow:"0 0 16px rgba(255,159,28,.35)" }}>{crownNotice}</div>}

      {state.pendingCrown?.player === me && (
        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Escolha a coroa</div>
            <div className="sub">VocÃÂª deve acertar a questÃÂ£o da categoria escolhida para conquistar a coroa.</div>
            <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
              {matchDisciplines.map(d => {
                const owned = state.crowns[d]?.[me];
                const hasAvailable = hasAvailableQuestion(activePool, state.used, d);
                return (
                  <button key={d} className="btn" onClick={() => selectCrownCategory(d)} disabled={owned || !hasAvailable}>
                    {d} {owned ? "Ã¢ÂÂ" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!current && myTurn && !state.pendingCrown && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Sua vez!</div>
            <div className="sub">Gire a roleta para sortear a categoria.</div>
            <button className="btn btnPrimary" onClick={handleSpin} style={{ marginTop: 8 }}>Girar roleta</button>
          </div>
        </div>
      )}

      {!myTurn && !current && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Aguardando oponente...</div>
            <div className="sub">O outro jogador estÃÂ¡ girando a roleta.</div>
          </div>
        </div>
      )}

      {current && !myQuestion && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Oponente respondendo</div>
            <div className="sub">Categoria: {current.category} {current.crown ? "Ã¢ÂÂ¢ Coroa" : ""}</div>
          </div>
        </div>
      )}

      {current && myQuestion && currentQ && (
        <QuestionView
          key={`${currentQ.id}-${attemptToken}`}
          q={currentQ}
          mode="duel"
          onSubmit={onSubmit}
          onNext={() => {}}
          onMark={() => {}}
          note=""
          onSaveNote={async () => {}}
          timeLimitMs={BASE_TIME_MS + extraTime}
          hiddenKeys={hiddenKeys}
          showNext={false}
          onSkipNull={skipNullQuestion}
          headerSlot={current.crown ? (
            <div className="pill" style={{ marginBottom: 10, color:"var(--warn-500)" }}>
              QuestÃÂ£o de coroa Ã¢ÂÂ¢ {current.category}
            </div>
          ) : undefined}
        />
      )}

      {reveal && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div style={{ fontWeight: 900, color: reveal.correct ? "var(--ok-500)" : "var(--warn-500)" }}>
            {reveal.correct ? "VocÃÂÃÂª acertou!" : "VocÃÂÃÂª errou!"}
          </div>
          {!reveal.correct && (
            <div style={{ marginTop: 6 }}>
              Correta: <b>{reveal.q.correctKey}</b> ÃÂ¢Ã¢ÂÂ¬Ã¢ÂÂ {reveal.q.options.find(o => o.key === reveal.q.correctKey)?.text ?? ""}
            </div>
          )}
        </div>
      )}

      {isOnline && (
        <div style={{ marginTop: 16 }} className="card">
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Chat da sala</div>
            <div style={{ marginTop: 8, display:"grid", gap: 8, maxHeight: 220, overflowY:"auto" }}>
              {chat.length === 0 && <div className="sub">Sem mensagens ainda.</div>}
              {chat.map(msg => (
                <div key={msg.id} className="pill" style={{ display:"flex", gap: 8, justifyContent:"space-between" }}>
                  <span>
                    <b>{msg.role === me ? "VocÃÂª" : "Oponente"}:</b> {msg.text}
                  </span>
                  <span style={{ color:"var(--ink-500)" }}>
                    {new Date(msg.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="Digite uma mensagem..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter"){
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
              <button className="btn btnPrimary" onClick={sendChat} disabled={!chatText.trim()}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {spinOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(7,10,20,.65)",
          display: "grid",
          placeItems: "center",
          padding: 16
        }}>
          <div className="card" style={{ padding: 16, width: "min(520px, 92vw)" }}>
            <div className="h3">Roleta do Duelo</div>
            <div className="sub">Gire para sortear a prÃÂ³xima disciplina.</div>
            <div className="pill" style={{ marginTop: 8, color:"var(--accent-500)" }}>
              HÃÂÃÂ¡ uma fatia de coroa direta na roleta.
            </div>
            <div style={{ marginTop: 12 }}>
              <Wheel
                onPick={onWheelPick}
                onCrown={onWheelCrown}
                includeCrown
                showHint={false}
                disciplines={availableDisciplines}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: React.ReactNode }){
  return (
    <div className="pill" style={{ display:"flex", gap: 6 }}>
      <span style={{ color:"var(--ink-500)" }}>{label}:</span>
      <span style={{ fontWeight: 900 }}>{value}</span>
    </div>
  );
}

function PowerBtn({ label, count, onClick, disabled, icon }: { label: string; count: number; onClick: ()=>void; disabled?: boolean; icon?: string }){
  return (
    <button className="btn" onClick={onClick} disabled={disabled || count <= 0} style={{ background:"rgba(255,255,255,.06)" }}>
      {icon ? `${icon} ` : ""}{label} ({count})
    </button>
  );
}

function initialLocalState(disciplines: Discipline[]): DuelState{
  const crowns = {} as DuelState["crowns"];
  disciplines.forEach((d) => { crowns[d] = { host: false, guest: false }; });
    const base = {
      disciplines,
      turn: "host" as Role,
      streak: { host: 0, guest: 0 },
      crowns,
      current: undefined,
      used: [],
      pendingCrown: undefined,
      chat: [],
      powers: {
        host: { bomb: 2, extraTime: 2, skip: 2, double: 2 },
        guest: { bomb: 2, extraTime: 2, skip: 2, double: 2 }
      },
    stats: { host: { correct: 0, total: 0 }, guest: { correct: 0, total: 0 } },
    bags: { host: [], guest: [] },
    recent: { host: [], guest: [] }
  };
  return base;
}

function pickQuestion(pool: Question[], used: Set<string>, category: Discipline): { id: string; discipline: Discipline } | null{
  const filtered = pool.filter(q => q.discipline === category && !used.has(q.id));
  if (filtered.length){
    const picked = filtered[randomInt(filtered.length)];
    return { id: picked.id, discipline: picked.discipline };
  }
  const sameDisc = pool.filter(q => q.discipline === category);
  if (sameDisc.length){
    const picked = sameDisc[randomInt(sameDisc.length)];
    return { id: picked.id, discipline: picked.discipline };
  }
  const fallback = pool.filter(q => !used.has(q.id));
  if (fallback.length){
    const picked = fallback[randomInt(fallback.length)];
    return { id: picked.id, discipline: picked.discipline };
  }
  if (!pool.length) return null;
  const picked = pool[randomInt(pool.length)];
  return { id: picked.id, discipline: picked.discipline };
}

function hasAvailableQuestion(pool: Question[], usedIds: string[], category: Discipline){
  return pool.some(q => q.discipline === category);
}

function prepareSpin(state: DuelState, player: Role, pool: Question[], disciplines: Discipline[]){
  const options = disciplines.filter(d => pool.some(q => q.discipline === d));
  const baseOptions = options.length ? options : disciplines;
  const pick = baseOptions[randomInt(baseOptions.length)] ?? baseOptions[0] ?? DISCIPLINES[0];
  const recentBase = state.recent ?? { host: [], guest: [] };
  const nextRecent = [...(recentBase[player] ?? []), pick].slice(-3);
  const base: DuelState = {
    ...state,
    recent: { ...recentBase, [player]: nextRecent }
  };
  return { category: pick, base };
}

function randomInt(max: number){
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues){
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return Number(arr[0] % max);
  }
  return Math.floor(Math.random() * max);
}

function pickWrongKey(q?: Question | null){
  if (!q) return "A";
  const wrong = q.options.map(o => o.key).filter(k => k !== q.correctKey);
  return wrong[randomInt(wrong.length)];
}

function shuffle<T>(arr: T[]): T[]{
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getStateDisciplines(state: DuelState): Discipline[]{
  const list = state.disciplines?.length ? state.disciplines : Object.keys(state.crowns) as Discipline[];
  return list.length ? list : DISCIPLINES;
}

function countCrowns(state: DuelState, player: Role){
  return getStateDisciplines(state).filter(d => state.crowns[d]?.[player]).length;
}

function unownedCategories(state: DuelState, player: Role){
  return getStateDisciplines(state).filter(d => !state.crowns[d]?.[player]);
}

function nextWinner(state: DuelState, room: DuelRoom, me: Role, clientId: string){
  const total = getStateDisciplines(state).length;
  const hostCount = getStateDisciplines(state).filter(d => state.crowns[d]?.host).length;
  const guestCount = getStateDisciplines(state).filter(d => state.crowns[d]?.guest).length;
  if (hostCount >= total) return room.host_id;
  if (guestCount >= total && room.guest_id) return room.guest_id;
  return null;
}

function localWinnerFromState(state: DuelState): Role | null{
  const total = getStateDisciplines(state).length;
  const hostCount = getStateDisciplines(state).filter(d => state.crowns[d]?.host).length;
  const guestCount = getStateDisciplines(state).filter(d => state.crowns[d]?.guest).length;
  if (hostCount >= total) return "host";
  if (guestCount >= total) return "guest";
  return null;
}
