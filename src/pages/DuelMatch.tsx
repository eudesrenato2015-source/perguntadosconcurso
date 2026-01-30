import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QuestionView from "../components/QuestionView";
import Wheel from "../components/Wheel";
import { getActiveQuestions } from "../services/packs";
import { getDuelClientId, updateRoomState, fetchRoomRecord, connectRoomChannel, type DuelRoom, type DuelState } from "../services/duelRoom";
import type { Discipline, Question } from "../types";
import { awardAttemptXP } from "../services/progress";
import { uid } from "../lib/uid";
import { putAttempt } from "../services/db";
import { DISCIPLINES } from "../data/disciplines";

type Role = "host" | "guest";
type PowerType = "bomb" | "extraTime" | "skip" | "double";

const BASE_TIME_MS = 45000;

export default function DuelMatch(){
  const nav = useNavigate();
  const [params] = useSearchParams();
  const code = params.get("code")?.toUpperCase() ?? "";
  const mode = params.get("mode") ?? (code ? "online" : "ghost");
  const ghostProfile = params.get("ghost") ?? "Equilibrado";

  const clientId = useMemo(() => getDuelClientId(), []);
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [localState, setLocalState] = useState<DuelState | null>(null);
  const [localWinner, setLocalWinner] = useState<Role | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [spinOpen, setSpinOpen] = useState(false);
  const [spinTarget, setSpinTarget] = useState<Discipline | null>(null);
  const [attemptToken, setAttemptToken] = useState(0);
  const [hiddenKeys, setHiddenKeys] = useState<Array<"A"|"B"|"C"|"D"|"E">>([]);
  const [extraTime, setExtraTime] = useState(0);
  const [doubleChance, setDoubleChance] = useState(false);
  const [retryUsed, setRetryUsed] = useState(false);
  const awaitingGhostRef = useRef(false);

  const activePool = useMemo(() => getActiveQuestions(), []);
  const questionMap = useMemo(() => new Map(activePool.map(q => [q.id, q])), [activePool]);
  const disciplines = useMemo(() => {
    const set = new Set(activePool.map(q => q.discipline));
    return Array.from(set.values());
  }, [activePool]);

  const isOnline = mode === "online";
  const me: Role = isOnline ? (room?.host_id === clientId ? "host" : "guest") : "host";

  const state = isOnline ? room?.state ?? null : localState;
  const current = state?.current;
  const currentQ = current?.questionId ? questionMap.get(current.questionId) ?? null : null;
  const myTurn = state?.turn === me;
  const myQuestion = current?.player === me;
  const winnerId = isOnline ? room?.winner_id ?? null : null;

  useEffect(() => {
    if (!isOnline){
      if (!localState){
        setLocalState(initialLocalState());
      }
      return;
    }
    if (!code) return;
    let cleanup: null | (()=>void) = null;
    (async () => {
      try {
        const channel = await connectRoomChannel(code, (next) => setRoom(next));
        await channel.waitForSubscribed();
        cleanup = channel.unsubscribe;
        const latest = await fetchRoomRecord(code);
        if (latest) setRoom(latest);
      } catch (err: any){
        console.error("[duel] connect failed", err?.message ?? err);
        setNotice("Falha ao conectar na sala.");
      }
    })();
    return () => cleanup?.();
  }, [isOnline, code]);

  useEffect(() => {
    if (!isOnline || !room) return;
    if (room.state) return;
    const init = initialLocalState();
    updateRoomState(room.code, init, room.version).then((next) => setRoom(next)).catch((err: any) => {
      console.error("[duel] init state failed", err?.message ?? err);
    });
  }, [isOnline, room?.code, room?.version, room?.state]);

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

  const handleSpin = () => {
    if (!state) return;
    if (!myTurn || current) return;
    if (state.pendingCrown?.player === me){
      return;
    }
    const pick = monteCarloPick(disciplines, activePool);
    setSpinTarget(pick);
    setSpinOpen(true);
  };

  const startQuestion = async (category: Discipline, crown: boolean) => {
    const s = ensureState();
    const used = new Set(s.used);
    const id = pickQuestionId(activePool, used, category);
    if (!id){
      setNotice("Sem questões disponíveis.");
      return;
    }
    used.add(id);
    const next: DuelState = {
      ...s,
      current: { questionId: id, category, crown, player: s.turn },
      used: Array.from(used),
      pendingCrown: undefined
    };
    const winnerRole = !isOnline ? localWinnerFromState(next) : null;
    if (winnerRole) setLocalWinner(winnerRole);
    await updateState(next);
  };

  const onWheelPick = async (category: Discipline) => {
    setSpinOpen(false);
    if (!state) return;
    const crownChance = Math.random() < 0.12;
    if (crownChance){
      const next: DuelState = { ...state, pendingCrown: { player: state.turn, reason: "wheel" } };
      await updateState(next);
      return;
    }
    await startQuestion(category, false);
  };

  const selectCrownCategory = async (category: Discipline) => {
    if (!state) return;
    if (state.pendingCrown?.player !== me) return;
    await startQuestion(category, true);
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
    }
    if (type === "extraTime"){
      await updateState(nextState);
      setExtraTime(15000);
    }
    if (type === "double"){
      await updateState(nextState);
      setDoubleChance(true);
    }
    if (type === "skip"){
      await resolveAnswer(false, "SKIP", 0, true, nextState);
    }
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
        next.crowns = {
          ...next.crowns,
          [current.category]: { ...next.crowns[current.category], [player]: true }
        };
        next.streak = { ...next.streak, [player]: 0 };
      }
      if (next.streak[player] >= 3){
        next.pendingCrown = { player, reason: "streak" };
        next.streak = { ...next.streak, [player]: 0 };
      }
    } else {
      next.streak = { ...next.streak, [player]: 0 };
      next.turn = opponent;
    }

    next.current = undefined;

    if (!skipped) awardAttemptXP({ isCorrect, timeSpentMs });
    await updateState(next);
  };

  const onSubmit = async ({ selectedKey, timeSpentMs }: { selectedKey: string; timeSpentMs: number }) => {
    if (!state || !currentQ || !current) return { isCorrect: false };
    const chosen = selectedKey || "TIMEOUT";
    const isCorrect = chosen === currentQ.correctKey;

    if (doubleChance && !retryUsed && !isCorrect){
      setRetryUsed(true);
      return { isCorrect: false, retry: true };
    }

    await resolveAnswer(isCorrect, chosen, timeSpentMs);
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
      const pick = monteCarloPick(disciplines, activePool);
      await startQuestion(pick, false);
    }, delay);
  }, [mode, state?.turn, state?.current, disciplines, activePool]);

  useEffect(() => {
    if (mode !== "ghost") return;
    if (!state || !current || current.player !== "guest") return;
    const accuracy = ghostProfile === "Preciso" ? 0.82 : ghostProfile === "Rápido" ? 0.6 : 0.7;
    const timeMs = ghostProfile === "Rápido" ? 4000 : ghostProfile === "Preciso" ? 8000 : 6000;
    const delay = timeMs * (0.7 + Math.random() * 0.6);
    const id = window.setTimeout(async () => {
      const isCorrect = Math.random() < accuracy;
      const key = isCorrect ? currentQ?.correctKey ?? "A" : pickWrongKey(currentQ);
      await resolveAnswer(isCorrect, key ?? "A", Math.round(delay));
    }, delay);
    return () => window.clearTimeout(id);
  }, [mode, current?.questionId, current?.player]);

  if (!state){
    return (
      <div style={{ padding: 16 }}>
        <div className="h3">Carregando duelo...</div>
      </div>
    );
  }

  if (!activePool.length){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Sem questões ativas</div>
        <div className="sub">Ative packs no Perfil para iniciar o duelo.</div>
        <button className="btn btnPrimary" onClick={() => nav("/perfil")}>Ir para Perfil</button>
      </div>
    );
  }

  if (isOnline && room && room.status !== "started"){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Aguardando início</div>
        <div className="sub">A sala ainda não iniciou a partida. Volte para o lobby e inicie.</div>
        <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
      </div>
    );
  }

  if (winnerId){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Duelo encerrado</div>
        <div className="sub">Vencedor: {winnerId === clientId ? "Você" : "Oponente"}</div>
        <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
      </div>
    );
  }
  if (!isOnline && localWinner){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Duelo encerrado</div>
        <div className="sub">Vencedor: {localWinner === "host" ? "Você" : "Fantasma"}</div>
        <button className="btn btnPrimary" onClick={() => nav("/duelo")}>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div className="h2">Duelo</div>
          <div className="sub">Quem errar passa a vez. 3 acertos = coroa. Coroa só se ganha acertando.</div>
        </div>
        <button className="btn" onClick={() => nav("/duelo")}>Sair</button>
      </div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12,1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Placar</div>
          <div className="row" style={{ marginTop: 8, flexWrap:"wrap", gap: 10 }}>
            <Pill label="Turno" value={state.turn === me ? "Sua vez" : "Oponente"} />
            <Pill label="Streak" value={state.streak[me]} />
            <Pill label="Coroas" value={countCrowns(state, me) + "/" + disciplines.length} />
          </div>
          <div style={{ marginTop: 8, display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px,1fr))", gap: 6 }}>
            {disciplines.map(d => (
              <div key={d} className="pill" style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{d}</span>
                <span style={{ color: state.crowns[d]?.[me] ? "var(--ok-500)" : "var(--ink-500)" }}>
                  {state.crowns[d]?.[me] ? "✓" : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Poderes</div>
          <div className="sub">Bombas removem 2 alternativas, +tempo adiciona 15s, pular passa a vez, dupla chance dá 2 tentativas.</div>
          <div className="row" style={{ marginTop: 8, flexWrap:"wrap" }}>
            <PowerBtn label="Bomba" count={state.powers[me].bomb} onClick={() => applyPower("bomb")} disabled={!myQuestion} />
            <PowerBtn label="+Tempo" count={state.powers[me].extraTime} onClick={() => applyPower("extraTime")} disabled={!myQuestion} />
            <PowerBtn label="Pular" count={state.powers[me].skip} onClick={() => applyPower("skip")} disabled={!myQuestion} />
            <PowerBtn label="Dupla" count={state.powers[me].double} onClick={() => applyPower("double")} disabled={!myQuestion} />
          </div>
        </div>
      </div>

      {notice && <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>{notice}</div>}

      {state.pendingCrown?.player === me && (
        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Escolha a coroa</div>
            <div className="sub">Você deve acertar a questão da categoria escolhida para conquistar a coroa.</div>
            <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
              {disciplines.map(d => (
                <button key={d} className="btn" onClick={() => selectCrownCategory(d)}>
                  {d}
                </button>
              ))}
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
            <div className="sub">O outro jogador está girando a roleta.</div>
          </div>
        </div>
      )}

      {current && !myQuestion && (
        <div style={{ marginTop: 12 }} className="card">
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>Oponente respondendo</div>
            <div className="sub">Categoria: {current.category} {current.crown ? "• Coroa" : ""}</div>
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
          headerSlot={current.crown ? (
            <div className="pill" style={{ marginBottom: 10, color:"var(--warn-500)" }}>
              Questão de coroa • {current.category}
            </div>
          ) : undefined}
        />
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
            <div className="sub">Gire para sortear a próxima disciplina.</div>
            <div style={{ marginTop: 12 }}>
              <Wheel onPick={onWheelPick} forcePick={spinTarget ?? undefined} showHint={false} disciplines={disciplines} />
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

function PowerBtn({ label, count, onClick, disabled }: { label: string; count: number; onClick: ()=>void; disabled?: boolean }){
  return (
    <button className="btn" onClick={onClick} disabled={disabled || count <= 0} style={{ background:"rgba(255,255,255,.06)" }}>
      {label} ({count})
    </button>
  );
}

function initialLocalState(): DuelState{
  const crowns = {} as DuelState["crowns"];
  DISCIPLINES.forEach((d) => { crowns[d] = { host: false, guest: false }; });
  const base = {
    turn: "host" as Role,
    streak: { host: 0, guest: 0 },
    crowns,
    current: undefined,
    used: [],
    pendingCrown: undefined,
    powers: {
      host: { bomb: 2, extraTime: 2, skip: 2, double: 2 },
      guest: { bomb: 2, extraTime: 2, skip: 2, double: 2 }
    }
  };
  return base;
}

function monteCarloPick(disciplines: Discipline[], pool: Question[]): Discipline{
  if (!disciplines.length) return "Português";
  const weights = disciplines.map(d => pool.filter(q => q.discipline === d).length || 1);
  const trials = 120;
  const counts = new Map<Discipline, number>();
  for (let i = 0; i < trials; i++){
    const pick = weightedPick(disciplines, weights);
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }
  let best = disciplines[0];
  let bestCount = -1;
  counts.forEach((v, k) => {
    if (v > bestCount){
      best = k;
      bestCount = v;
    }
  });
  return best;
}

function weightedPick(disciplines: Discipline[], weights: number[]): Discipline{
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < disciplines.length; i++){
    r -= weights[i];
    if (r <= 0) return disciplines[i];
  }
  return disciplines[disciplines.length - 1];
}

function pickQuestionId(pool: Question[], used: Set<string>, category: Discipline): string | null{
  const filtered = pool.filter(q => q.discipline === category && !used.has(q.id));
  if (!filtered.length){
    const fallback = pool.filter(q => !used.has(q.id));
    if (!fallback.length) return null;
    return fallback[Math.floor(Math.random() * fallback.length)].id;
  }
  return filtered[Math.floor(Math.random() * filtered.length)].id;
}

function pickWrongKey(q?: Question | null){
  if (!q) return "A";
  const wrong = q.options.map(o => o.key).filter(k => k !== q.correctKey);
  return wrong[Math.floor(Math.random() * wrong.length)];
}

function shuffle<T>(arr: T[]): T[]{
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function countCrowns(state: DuelState, player: Role){
  return Object.values(state.crowns).filter(v => v?.[player]).length;
}

function nextWinner(state: DuelState, room: DuelRoom, me: Role, clientId: string){
  const total = Object.keys(state.crowns).length;
  const hostCount = Object.values(state.crowns).filter(v => v.host).length;
  const guestCount = Object.values(state.crowns).filter(v => v.guest).length;
  if (hostCount >= total) return room.host_id;
  if (guestCount >= total && room.guest_id) return room.guest_id;
  return null;
}

function localWinnerFromState(state: DuelState): Role | null{
  const total = Object.keys(state.crowns).length;
  const hostCount = Object.values(state.crowns).filter(v => v.host).length;
  const guestCount = Object.values(state.crowns).filter(v => v.guest).length;
  if (hostCount >= total) return "host";
  if (guestCount >= total) return "guest";
  return null;
}
