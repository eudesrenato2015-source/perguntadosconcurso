import React, { useEffect, useRef, useState } from "react";
import type { Question, RunMode } from "../types";
import Mascot from "./Mascot";
import { fmtMs } from "../lib/time";

export default function QuestionView({
  q, mode, onSubmit, onNext, onMark, note, onSaveNote, timeLimitMs, hiddenKeys, disabledKeys, headerSlot, showNext
}: {
  q: Question;
  mode: RunMode;
  onSubmit: (payload: { selectedKey: string; timeSpentMs: number; markedForReview: boolean; confidence?: 1|2|3|4|5 }) => Promise<{ isCorrect: boolean; retry?: boolean }>;
  onNext: () => void;
  onMark: (marked: boolean) => void;
  note: string;
  onSaveNote: (text: string) => Promise<void>;
  timeLimitMs?: number;
  hiddenKeys?: Array<"A"|"B"|"C"|"D"|"E">;
  disabledKeys?: Array<"A"|"B"|"C"|"D"|"E">;
  headerSlot?: React.ReactNode;
  showNext?: boolean;
}){
  const showNextSection = showNext !== false;
  const startRef = useRef<number>(Date.now());
  const [selected, setSelected] = useState<"A"|"B"|"C"|"D"|"E"|null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [marked, setMarked] = useState(false);
  const [confidence, setConfidence] = useState<1|2|3|4|5|undefined>(undefined);
  const [savingNote, setSavingNote] = useState(false);
  const [noteText, setNoteText] = useState(note);
  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimitMs ?? null);
  const [timedOut, setTimedOut] = useState(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const timeoutFiredRef = useRef(false);

  const showKeys = q.type === "TF" ? (["A","B"] as const) : (["A","B","C","D","E"] as const);
  const hidden = new Set(hiddenKeys ?? []);
  const disabled = new Set(disabledKeys ?? []);

  const stateFor = (k: "A"|"B"|"C"|"D"|"E") => {
    if (!submitted){
      if (selected === k) return "selected";
      return "idle";
    }
    if (k === q.correctKey) return "correct";
    if (selected === k) return "wrong";
    return "disabled";
  };

  const submit = async () => {
    if (!selected || submitted) return;
    const timeSpentMs = Date.now() - startRef.current;
    const res = await onSubmit({ selectedKey: selected, timeSpentMs, markedForReview: marked, confidence });
    if (res.retry){
      setRetryNotice("Você ganhou uma segunda chance!");
      setSelected(null);
      setSubmitted(false);
      setCorrect(false);
      startRef.current = Date.now();
      return;
    }
    setRetryNotice(null);
    setSubmitted(true);
    setCorrect(res.isCorrect);
  };

  const handleTimeout = async () => {
    if (submitted || timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    const timeSpentMs = timeLimitMs ?? (Date.now() - startRef.current);
    const res = await onSubmit({ selectedKey: "", timeSpentMs, markedForReview: marked, confidence });
    if (res.retry){
      setRetryNotice("Tempo estourou, mas você ganhou uma segunda chance!");
      setSelected(null);
      setSubmitted(false);
      setCorrect(false);
      startRef.current = Date.now();
      return;
    }
    setRetryNotice(null);
    setSubmitted(true);
    setCorrect(res.isCorrect);
    setTimedOut(true);
  };

  useEffect(() => {
    if (!timeLimitMs || submitted) return;
    timeoutFiredRef.current = false;
    const endAt = startRef.current + timeLimitMs;
    const tick = () => {
      const left = Math.max(0, endAt - Date.now());
      setTimeLeft(left);
      if (left <= 0){
        handleTimeout();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timeLimitMs, submitted]);

  const mood = !submitted ? "neutral" : (correct ? "hype" : "think");

  return (
    <div style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent:"space-between", alignItems:"flex-start", gap: 16 }}>
        <div style={{ flex:1 }}>
          <div className="pill" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 900 }}>{q.discipline}</span>
            <span style={{ color:"var(--ink-500)" }}>{q.subject} • {q.topic}</span>
            <span style={{ marginLeft:"auto", color:"var(--ink-500)" }}>D{q.difficulty}</span>
            {timeLeft != null && (
              <span style={{ color:"var(--warn-500)", fontWeight: 800 }}>
                Tempo: {Math.ceil(timeLeft / 1000)}s
              </span>
            )}
          </div>
          {headerSlot}

          <div className="card" style={{ padding: 14, borderRadius: 22 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Enunciado</div>
            <div style={{ color:"var(--ink-700)", lineHeight: 1.45 }}>{q.statement}</div>
          </div>
        </div>

        <div style={{ width: 92, textAlign:"center" }}>
          <Mascot mood={mood as any} size={84} />
          <div style={{ fontSize: 12, color:"var(--ink-500)" }}>{mode.toUpperCase()}</div>
        </div>
      </div>

      <div className="sep" />

      <div style={{ display:"grid", gap: 10 }}>
        {showKeys.map((k) => {
          if (hidden.has(k)) return null;
          return (
            <Option
              key={k}
              label={k}
              text={q.options.find(o => o.key === k)?.text ?? ""}
              state={stateFor(k)}
              disabled={disabled.has(k)}
              onClick={() => !submitted && !disabled.has(k) && setSelected(k)}
            />
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap:"wrap" }}>
        <button className={"btn " + (!selected ? "" : "btnPrimary")} disabled={!selected || submitted} onClick={submit}>
          {submitted ? (timedOut ? "Tempo esgotado" : (correct ? "Acertou ✓" : "Errou ✖")) : "Confirmar"}
        </button>

        <button className="btn" onClick={() => { setMarked(m=>{ const nx = !m; onMark(nx); return nx; }); }} disabled={submitted}>
          {marked ? "Marcada p/ revisão" : "Marcar revisão"}
        </button>

        <div className="pill" style={{ marginLeft:"auto" }}>
          <span style={{ color:"var(--ink-500)" }}>Confiança:</span>
          {[1,2,3,4,5].map(v => (
            <button
              key={v}
              className="btn"
              style={{ padding:"6px 10px", background: confidence===v ? "rgba(24,210,163,.22)" : "rgba(255,255,255,.06)" }}
              onClick={() => !submitted && setConfidence(v as any)}
              disabled={submitted}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {retryNotice && (
        <div className="pill" style={{ marginTop: 10, color:"var(--warn-500)" }}>{retryNotice}</div>
      )}

      {submitted && (
        <div style={{ marginTop: 14 }} className="card">
          <div style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent:"space-between" }}>
              <div style={{ fontWeight: 900 }}>Explicação (3 camadas)</div>
              <div className="pill" style={{ color:"var(--ink-500)" }}>Tempo: {fmtMs(Date.now()-startRef.current)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 850 }}>Resumo</div>
              <div style={{ color:"var(--ink-700)", marginTop: 4 }}>{q.explanation.summary}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 850 }}>Por que a certa é certa</div>
              <div style={{ color:"var(--ink-700)", marginTop: 4 }}>{q.explanation.whyCorrect}</div>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor:"pointer", fontWeight: 850 }}>Por que as erradas estão erradas</summary>
              <div style={{ marginTop: 8, display:"grid", gap: 8 }}>
                {(["A","B","C","D","E"] as const).map(k => (
                  <div key={k} className="kpi">
                    <div style={{ fontWeight: 900 }}>{k}</div>
                    <div style={{ color:"var(--ink-700)" }}>{q.explanation.whyWrong[k] ?? (k===q.correctKey ? "Correta." : "Distrator.")}</div>
                  </div>
                ))}
              </div>
            </details>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 850 }}>Dica de prova</div>
              <ul style={{ margin:"6px 0 0 18px", color:"var(--ink-700)" }}>
                {q.explanation.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>

            {showNextSection && (
              <>
                <div className="sep" />
                <div className="row" style={{ alignItems:"stretch", flexWrap:"wrap" }}>
                  <button className="btn btnPrimary" onClick={onNext}>Próxima</button>
                  <div style={{ flex: 1 }} />
                  <div style={{ minWidth: 260, flex: 1 }}>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Anotação</div>
                    <textarea
                      value={noteText}
                      onChange={(e)=>setNoteText(e.target.value)}
                      className="input"
                      style={{ minHeight: 92, resize:"vertical" }}
                      placeholder="Escreva um macete, exceção, pegadinha..."
                    />
                    <div className="row" style={{ justifyContent:"flex-end", marginTop: 8 }}>
                      <button
                        className="btn"
                        onClick={async () => {
                          setSavingNote(true);
                          try { await onSaveNote(noteText); } finally { setSavingNote(false); }
                        }}
                        disabled={savingNote}
                      >
                        {savingNote ? "Salvando..." : "Salvar anotação"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

function Option({ label, text, state, onClick, disabled }: { label: string; text: string; state: "idle"|"selected"|"correct"|"wrong"|"disabled"; onClick: ()=>void; disabled?: boolean }){
  const styles: Record<string, React.CSSProperties> = {
    idle: { background:"rgba(255,255,255,.06)", border:"1px solid var(--line-200)" },
    selected: { background:"rgba(24,210,163,.18)", border:"1px solid rgba(24,210,163,.55)" },
    correct: { background:"rgba(52,211,153,.18)", border:"1px solid rgba(52,211,153,.55)" },
    wrong: { background:"rgba(251,113,133,.18)", border:"1px solid rgba(251,113,133,.55)" },
    disabled: { background:"rgba(255,255,255,.04)", border:"1px solid var(--line-200)", opacity: .85 }
  };
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={disabled || state === "disabled" || state === "correct" || state === "wrong"}
      style={{
        textAlign:"left",
        borderRadius: 18,
        padding: "12px 14px",
        display:"flex",
        gap: 10,
        alignItems:"flex-start",
        transform: "none",
        ...styles[state]
      }}
    >
      <span className="pill" style={{ padding:"6px 10px", fontWeight: 900, borderRadius: 12 }}>{label}</span>
      <span style={{ color:"var(--ink-700)", lineHeight: 1.35 }}>{text}</span>
    </button>
  );
}
