import React, { useMemo, useState } from "react";
import type { Discipline, ExamStyle, Question } from "../types";
import { filterQuestions } from "../services/recommendation";
import { newSession } from "../services/session";
import { useNavigate } from "react-router-dom";
import { DISCIPLINES } from "../data/disciplines";
import { getActiveQuestions } from "../services/packs";

const disciplines: (Discipline|"Todas")[] = ["Todas", ...DISCIPLINES];
const types: ("Todas"|"MCQ"|"TF")[] = ["Todas","MCQ","TF"];
const diffs: ("Todas"|1|2|3|4|5)[] = ["Todas",1,2,3,4,5];
const styles: ("Todas"|ExamStyle)[] = ["Todas","CEBRASPE","CESPE","FGV","VUNESP","FCC","IBFC","QUADRIX","AOCP"];

export default function Library(){
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState<Discipline|"Todas">("Todas");
  const [topic, setTopic] = useState<string>("Todos");
  const [type, setType] = useState<"Todas"|"MCQ"|"TF">("Todas");
  const [difficulty, setDifficulty] = useState<"Todas"|1|2|3|4|5>("Todas");
  const [style, setStyle] = useState<"Todas"|ExamStyle>("Todas");

  const pool = useMemo(() => getActiveQuestions(), []);

  const topicOptions = useMemo(() => {
    const base = discipline === "Todas" ? pool : pool.filter(p => p.discipline === discipline);
    const set = new Set(base.map(q => q.topic));
    return ["Todos", ...Array.from(set).sort()];
  }, [pool, discipline]);

  const results = useMemo(() => filterQuestions({ q, discipline, topic, type, difficulty, style, pool }), [q, discipline, topic, type, difficulty, style, pool]);

  const startOne = (item: Question) => {
    newSession("library", [item.id], { discipline: item.discipline, label: "Biblioteca • 1 questão" });
    nav("/questao");
  };

  const startList = () => {
    const ids = results.slice(0, 15).map(r => r.id);
    newSession("library", ids, { label: "Biblioteca • lista filtrada" });
    nav("/questao");
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Biblioteca</div>
      <div className="sub">Filtre pesado e monte seu treino. (Tudo offline por enquanto.)</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div style={{ gridColumn:"span 12" }}>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar no enunciado/assunto/tópico" />
        </div>
        <Select label="Disciplina" value={discipline} onChange={(v) => { setDiscipline(v); setTopic("Todos"); }} options={disciplines} span={3} />
        <Select label="Tópico" value={topic} onChange={setTopic} options={topicOptions} span={3} />
        <Select label="Tipo" value={type} onChange={setType} options={types} span={2} />
        <Select label="Dificuldade" value={difficulty} onChange={setDifficulty} options={diffs} span={2} />
        <Select label="Estilo" value={style} onChange={setStyle} options={styles} span={2} />
        <div style={{ gridColumn:"span 12" }} className="row">
          <button className="btn btnPrimary" onClick={startList} disabled={results.length === 0}>Treinar (até 15)</button>
          <span className="pill" style={{ color:"var(--ink-500)" }}>{results.length} resultados</span>
        </div>
      </div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        {results.slice(0, 20).map((item) => (
          <div key={item.id} className="kpi" style={{ gridColumn:"span 12" }}>
            <div className="row" style={{ justifyContent:"space-between" }}>
              <div style={{ fontWeight: 900 }}>
                {item.discipline} • D{item.difficulty} • {item.type}{item.style ? ` • ${item.style}` : ""}
              </div>
              <button className="btn" onClick={()=>startOne(item)}>Resolver</button>
            </div>
            <div className="sub" style={{ marginTop: 6 }}>{item.statement}</div>
          </div>
        ))}
      </div>
      <div className="sub" style={{ marginTop: 10 }}>Mostrando 20. Use filtros pra afinar.</div>
    </div>
  );
}

function Select<T extends string | number>({
  label, value, onChange, options, span = 4
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  span?: number;
}){
  return (
    <div style={{ gridColumn:`span ${span}`, minWidth: 0 }}>
      <div className="sub" style={{ marginBottom: 6 }}>{label}</div>
      <select
        className="input"
        value={String(value)}
        onChange={(e)=>onChange((typeof options[0] === "number" ? Number(e.target.value) : e.target.value) as T)}
      >
        {options.map(o => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
      </select>
    </div>
  );
}

