import React, { useMemo, useState } from "react";
import type { Discipline, ExamStyle, PackDiscipline, Question, QuestionPack } from "../types";
import { addUserPack } from "../services/packs";
import { uid } from "../lib/uid";
import { DISCIPLINES } from "../data/disciplines";

const disciplines: PackDiscipline[] = ["Misto", ...DISCIPLINES];
const styles: ("Nenhum"|ExamStyle)[] = ["Nenhum","CEBRASPE","CESPE","FGV","VUNESP","FCC","IBFC","QUADRIX","AOCP"];

type OptionKey = "A"|"B"|"C"|"D"|"E";
const optionKeys: OptionKey[] = ["A","B","C","D","E"];

const baseDisciplines: Discipline[] = [...DISCIPLINES];

export default function ImportPage(){
  const [packName, setPackName] = useState("Pack importado");
  const [discipline, setDiscipline] = useState<PackDiscipline>("Misto");
  const [style, setStyle] = useState<"Nenhum"|ExamStyle>("Nenhum");
  const [rawText, setRawText] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [perTopic, setPerTopic] = useState(2);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const topicList = useMemo(() => topicsText.split(/\r?\n/).map(t => t.trim()).filter(Boolean), [topicsText]);

  const extractTopics = () => {
    const topics = extractHeadings(rawText);
    if (!topics.length){
      setNotice("Não encontrei tópicos claros. Tente colar um texto mais estruturado.");
    } else {
      setNotice(null);
    }
    setTopicsText(topics.join("\n"));
  };

  const onPdf = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setNotice("Extraindo texto do PDF...");
    try {
      const text = await extractFromPdf(file);
      setRawText(text);
      setNotice("PDF carregado. Ajuste o texto se quiser e extraia os tópicos.");
    } catch {
      setNotice("Falha ao ler PDF. Use o modo 'colar texto' como alternativa.");
    } finally {
      setBusy(false);
    }
  };

  const generatePack = () => {
    if (!topicList.length){
      setNotice("Adicione tópicos antes de gerar as questões.");
      return;
    }
    const questions = buildQuestions({
      topics: topicList.slice(0, 60),
      perTopic,
      discipline,
      style: style === "Nenhum" ? undefined : style
    });
    const pack: QuestionPack = {
      id: `user-${uid("pack")}`,
      name: packName.trim() || "Pack importado",
      discipline,
      questions
    };
    addUserPack(pack);
    setNotice(`Pack criado com ${questions.length} questões.`);
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Importar</div>
      <div className="sub">Offline-first: extraia tópicos e gere questões locais.</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Configuração do pack</div>
          <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)", marginTop: 10 }}>
            <div style={{ gridColumn:"span 6" }}>
              <div className="sub">Nome do pack</div>
              <input className="input" value={packName} onChange={(e)=>setPackName(e.target.value)} />
            </div>
            <div style={{ gridColumn:"span 3" }}>
              <div className="sub">Disciplina</div>
              <select className="input" value={discipline} onChange={(e)=>setDiscipline(e.target.value as PackDiscipline)}>
                {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"span 3" }}>
              <div className="sub">Estilo</div>
              <select className="input" value={style} onChange={(e)=>setStyle(e.target.value as any)}>
                {styles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"span 3" }}>
              <div className="sub">Questões por tópico</div>
              <input
                className="input"
                type="number"
                min={1}
                max={4}
                value={perTopic}
                onChange={(e)=>setPerTopic(Math.max(1, Math.min(4, Number(e.target.value))))}
              />
            </div>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>PDF (opcional)</div>
          <div className="sub">Sem OCR pesado. Extração de texto direta.</div>
          <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e)=>onPdf(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Cole seu texto</div>
          <div className="sub">Cole aqui o conteúdo do edital/aula. Depois extraia tópicos.</div>
          <textarea
            className="input"
            style={{ marginTop: 10, minHeight: 140, resize:"vertical" }}
            value={rawText}
            onChange={(e)=>setRawText(e.target.value)}
            placeholder="Cole aqui o texto base..."
          />
          <div className="row" style={{ marginTop: 10, flexWrap:"wrap" }}>
            <button className="btn" onClick={extractTopics} disabled={!rawText.trim() || busy}>Extrair tópicos</button>
          </div>
        </div>

        <div className="kpi" style={{ gridColumn:"span 12" }}>
          <div style={{ fontWeight: 900 }}>Tópicos (um por linha)</div>
          <textarea
            className="input"
            style={{ marginTop: 10, minHeight: 140, resize:"vertical" }}
            value={topicsText}
            onChange={(e)=>setTopicsText(e.target.value)}
            placeholder="Ex: Regime jurídico • Atribuições • Competências..."
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btnPrimary" onClick={generatePack}>Gerar questões</button>
            <span className="pill">{topicList.length} tópicos</span>
          </div>
        </div>
      </div>

      {notice && <div className="pill" style={{ marginTop: 12 }}>{notice}</div>}
    </div>
  );
}

function extractHeadings(text: string){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const topics: string[] = [];
  const seen = new Set<string>();

  const push = (t: string) => {
    const clean = t.replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 4 || clean.length > 90) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    topics.push(clean);
  };

  lines.forEach(line => {
    if (/^\d+[\.)-]/.test(line)) push(line.replace(/^\d+[\.)-]\s*/, ""));
    else if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ0-9\s]{6,}$/.test(line)) push(line);
    else if (line.endsWith(":" ) && line.length < 80) push(line.replace(/:$/, ""));
  });

  if (!topics.length){
    lines.slice(0, 24).forEach(line => push(line));
  }

  return topics.slice(0, 60);
}

function buildQuestions(opts: { topics: string[]; perTopic: number; discipline: PackDiscipline; style?: ExamStyle }): Question[]{
  const rng = mulberry32(hashString(opts.topics.join("|")));
  const out: Question[] = [];

  opts.topics.forEach((topic, idx) => {
    for (let i=0;i<opts.perTopic;i++){
      const variant = Math.floor(rng()*3);
      const disc = opts.discipline === "Misto"
        ? baseDisciplines[(idx + i) % baseDisciplines.length]
        : opts.discipline;
      out.push(makeQuestion(rng, topic, disc, variant, opts.style));
    }
  });

  return out;
}

function makeQuestion(rng: ()=>number, topic: string, discipline: Discipline, variant: number, style?: ExamStyle): Question{
  const stem = variant === 2
    ? `Assinale a alternativa que NÃO se aplica a ${topic}.`
    : variant === 1
      ? `Em ${topic}, é correto afirmar que:`
      : `Sobre ${topic}, assinale a alternativa correta.`;

  const correctPool = [
    `${topic} exige observância de princípios e critérios objetivos.`,
    `${topic} deve ser interpretado de forma sistemática e contextual.`,
    `${topic} comporta exceções expressas em lei ou regulamento específico.`,
    `${topic} depende de competência formal e motivação suficiente.`,
    `${topic} possui requisitos mínimos para validade e eficácia.`
  ];
  const wrongPool = [
    `${topic} é sempre aplicado de forma automática, sem margem interpretativa.`,
    `${topic} dispensa fundamentação e controle quando praticado pela autoridade máxima.`,
    `${topic} afasta totalmente a incidência de princípios constitucionais.`,
    `${topic} admite retroatividade ampla, mesmo em prejuízo do administrado.`,
    `${topic} pode ser substituído por ato de conveniência, sem previsão legal.`,
    `${topic} prescinde de competência, bastando a vontade do agente.`,
    `${topic} produz efeitos ilimitados, independentemente de prazo ou condição.`
  ];

  const { options, correctKey, whyWrong } = mcqFromPools(rng, correctPool, wrongPool);

  return {
    id: uid("imp"),
    discipline,
    subject: topic.split(" ")[0],
    topic,
    difficulty: 3,
    type: "MCQ",
    style,
    statement: stem,
    options,
    correctKey,
    explanation: {
      summary: `Questão criada a partir do tópico '${topic}'.`,
      whyCorrect: `A alternativa correta reflete a aplicação adequada de ${topic}.`,
      whyWrong,
      tips: ["Releia o enunciado com atenção a termos absolutos.", "Busque exceções expressas."]
    }
  };
}

function mcqFromPools(rng: ()=>number, correctPool: string[], wrongPool: string[]){
  const correct = pick(rng, correctPool);
  const wrongs = pickMany(rng, wrongPool, 4);
  const choices: { text: string; correct: boolean }[] = [
    { text: correct, correct: true },
    ...wrongs.map(text => ({ text, correct: false }))
  ];
  const shuffled = shuffle(rng, choices);
  let correctIndex = shuffled.findIndex(c => c.correct);
  if (correctIndex < 0) correctIndex = 0;
  const whyWrong: Partial<Record<OptionKey, string>> = {};
  shuffled.forEach((item, idx) => {
    if (!item.correct){
      whyWrong[optionKeys[idx]] = "Distrator: contraria requisito/condição do tópico.";
    }
  });
  return {
    options: shuffled.map((item, idx) => ({ key: optionKeys[idx], text: item.text })),
    correctKey: optionKeys[correctIndex],
    whyWrong
  };
}

function pick<T>(rng: ()=>number, arr: T[]): T{
  return arr[Math.floor(rng() * arr.length)];
}
function shuffle<T>(rng: ()=>number, arr: T[]): T[]{
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function pickMany<T>(rng: ()=>number, arr: T[], n: number): T[]{
  return shuffle(rng, arr).slice(0, Math.min(n, arr.length));
}

function hashString(input: string){
  let h = 2166136261;
  for (let i=0;i<input.length;i++){
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function extractFromPdf(file: File): Promise<string>{
  const { default: pdfjsLib } = await import("pdfjs-dist");
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = (content.items as any[]).map(i => i.str as string);
    text += strings.join(" ") + "\n";
  }
  return text.replace(/\s+/g, " ").trim();
}


