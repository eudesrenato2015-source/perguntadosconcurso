import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuestionView from "../components/QuestionView";
import { getSession, advanceSession, clearSession, patchSession } from "../services/session";
import { getNoteByQuestion, getSR, putAttempt, putNote, putSR } from "../services/db";
import type { Discipline, Question, SRItem } from "../types";
import { uid } from "../lib/uid";
import { updateSR } from "../services/sr";
import { getActiveQuestions, getAllQuestions } from "../services/packs";
import { awardAttemptXP } from "../services/progress";
import { closeDuelChannel, sendDuelEvent, subscribeDuelEvents } from "../services/online";
import Wheel from "../components/Wheel";
import { sfx, useSfxEnabled } from "../services/sfx";

export default function QuestionRunner(){
  const nav = useNavigate();
  const [session, setSessionState] = useState(() => getSession());
  const [note, setNote] = useState("");
  const [q, setQ] = useState<Question | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const timeEndRef = useRef(false);
  const [spinVisible, setSpinVisible] = useState(false);
  const [spinTarget, setSpinTarget] = useState<Discipline | null>(null);
  const { enabled: sfxEnabled, toggle: toggleSfx } = useSfxEnabled();
  const activePool = useMemo(() => getActiveQuestions(), []);
  const activeDisciplines = useMemo(() => {
    const set = new Set(activePool.map(item => item.discipline));
    return Array.from(set.values());
  }, [activePool]);

  const qId = session?.queue?.[session.index ?? 0];
  const allQuestions = useMemo(() => getAllQuestions(), []);
  const questionMap = useMemo(() => new Map(allQuestions.map(item => [item.id, item])), [allQuestions]);

  useEffect(() => {
    if (!session){ nav("/"); return; }
    const pool = activePool;
    const item = pool.find(x => x.id === qId) ?? getAllQuestions().find(x => x.id === qId) ?? null;
    setQ(item);
    (async () => {
      if (!qId) return;
      const n = await getNoteByQuestion(qId);
      setNote(n?.text ?? "");
    })();
  }, [qId]);

  useEffect(() => {
    if (!session) return;
    const onlineCode = (session.meta as any)?.onlineCode as string | undefined;
    if (!onlineCode) return;
    return subscribeDuelEvents(onlineCode, (payload) => {
      if (payload.type !== "answer") return;
      const current = getSession();
      if (!current) return;
      const meta = (current.meta as any) ?? {};
      const peerScore = Number(meta.peerScore ?? 0) + Number(payload.scoreAdd ?? 0);
      const next = patchSession({ meta: { ...meta, peerScore } });
      if (next) setSessionState(next);
    });
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const limit = Number((session.meta as any)?.timeLimitMs ?? 0);
    if (!limit){
      setRemainingMs(null);
      return;
    }
    timeEndRef.current = false;
    const tick = () => {
      const elapsed = Date.now() - session.createdAt;
      const left = Math.max(0, limit - elapsed);
      setRemainingMs(left);
      if (left <= 0 && !timeEndRef.current){
        timeEndRef.current = true;
        const next = patchSession({ index: session.queue.length, meta: { ...(session.meta as any), timeUp: true } });
        if (next) setSessionState(next);
        nav("/resultado");
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [session?.id]);

  const label = session?.seed?.label ?? session?.mode ?? "Rodada";

  const done = () => {
    closeDuelChannel();
    clearSession();
    setSessionState(null);
    nav("/");
  };

  if (!session || !qId || !q){
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 900 }}>Sem rodada ativa.</div>
        <button className="btn btnPrimary" onClick={()=>nav("/")}>Voltar</button>
      </div>
    );
  }

  const submit = async ({ selectedKey, timeSpentMs, markedForReview, confidence }: { selectedKey: string; timeSpentMs: number; markedForReview: boolean; confidence?: 1|2|3|4|5 }) => {
    const chosen = selectedKey || "TIMEOUT";
    const isCorrect = chosen === q.correctKey;
    await putAttempt({
      id: uid("att"),
      questionId: q.id,
      createdAt: Date.now(),
      mode: session.mode,
      selectedKey: chosen,
      isCorrect,
      timeSpentMs,
      markedForReview,
      flagged: false,
      confidence
    });

    const prev = await getSR(q.id);
    const nextBase = updateSR(prev ?? null, { isCorrect, confidence });
    const next: SRItem = { ...nextBase, questionId: q.id };
    await putSR(next);

    const meta: any = session.meta ?? {};
    const scoreAdd = (isCorrect ? 100 : 0) + (isCorrect ? Math.max(0, Math.round((12000 - timeSpentMs) / 600)) : 0);

    if (meta.ghost){
      const myScore = Number(meta?.myScore ?? 0) + scoreAdd;
      const patched = patchSession({ meta: { ...meta, myScore } });
      if (patched) setSessionState(patched);
    }

    if (meta.onlineCode){
      const myScore = Number(meta?.myScore ?? 0) + scoreAdd;
      const patched = patchSession({ meta: { ...meta, myScore } });
      if (patched) setSessionState(patched);
      sendDuelEvent(meta.onlineCode, { type: "answer", scoreAdd, isCorrect, timeSpentMs, questionId: q.id });
    }

    awardAttemptXP({ isCorrect, timeSpentMs });
    if (sfxEnabled){
      isCorrect ? sfx.correct() : sfx.wrong();
    }

    return { isCorrect };
  };

  const advance = () => {
    const nx = advanceSession();
    if (!nx) return done();
    setSessionState(nx);
    if (nx.index >= nx.queue.length){ nav("/resultado"); return; }
  };

  const handleSpinPick = () => {
    setSpinVisible(false);
    advance();
  };

  const next = () => {
    if (!session) return;
    if (spinVisible) return;
    if (session.mode === "duel"){
      const nextIndex = session.index + 1;
      if (nextIndex >= session.queue.length){ nav("/resultado"); return; }
      const nextId = session.queue[nextIndex];
      const nextQ = nextId ? questionMap.get(nextId) : undefined;
      setSpinTarget(nextQ?.discipline ?? null);
      setSpinVisible(true);
      if (sfxEnabled) sfx.spin();
      return;
    }
    advance();
  };

  const saveNote = async (text: string) => {
    await putNote({ id: uid("note"), questionId: q.id, text, createdAt: Date.now(), updatedAt: Date.now() });
    setNote(text);
  };

  return (
    <div>
      <div style={{ padding: "12px 16px 0 16px" }}>
        <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
          <div className="pill">
            <span style={{ fontWeight: 900 }}>{label}</span>
            <span style={{ color:"var(--ink-500)" }}>{session.index+1}/{session.queue.length}</span>
            {remainingMs != null && (
              <span style={{ color:"var(--warn-500)", fontWeight: 700 }}>Tempo: {Math.ceil(remainingMs/1000)}s</span>
            )}
          </div>
          <button className="btn" onClick={done}>Encerrar</button>
          <button className="btn" onClick={toggleSfx}>{sfxEnabled ? "Som: ligado" : "Som: desligado"}</button>
        </div>
      </div>

      <QuestionView
        key={q.id}
        q={q}
        mode={session.mode}
        onSubmit={submit}
        onNext={next}
        onMark={()=>{}}
        note={note}
        onSaveNote={saveNote}
        timeLimitMs={session.mode === "duel" ? 45000 : undefined}
      />

      {spinVisible && (
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
              <Wheel onPick={handleSpinPick} forcePick={spinTarget ?? undefined} showHint={false} disciplines={activeDisciplines} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







