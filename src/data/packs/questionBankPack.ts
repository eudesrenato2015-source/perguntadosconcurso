import type { Question, QuestionPack, Discipline } from "../../types";
import { QUESTIONS as BANK_QUESTIONS, type Question as BankQuestion } from "../question_bank";

function stripAccents(text: string){
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferDiscipline(source?: string | null, statement?: string | null, subject?: string | null): Discipline {
  const src = `${subject ?? ""} ${source ?? ""} ${statement ?? ""}`.toLowerCase();
  const t = stripAccents(src);
  const hasPortugues = [
    "portugues", "lingua portuguesa", "gramatica", "ortografia", "acentuacao",
    "crase", "concordancia", "regencia", "pontuacao", "sintaxe", "morfologia",
    "semantica", "interpreta", "texto", "coesao", "coerencia", "figura de linguagem",
    "voz ativa", "voz passiva", "substantivo", "adjetivo", "verbo", "pronome"
  ].some(k => t.includes(k));
  if (hasPortugues) return "Português";

  if (t.includes("constitucional") || t.includes("constituicao") || t.includes("cf") || t.includes("art. 5") || t.includes("direitos fundamentais")) return "Constitucional";
  if (t.includes("administrativo") || t.includes("licit") || t.includes("ato administrativo") || t.includes("poderes da administracao") || t.includes("improbidade") || t.includes("servidor") || t.includes("processo administrativo") || t.includes("lei 8666") || t.includes("8.666")) return "Administrativo";
  if (t.includes("penal") || t.includes("processo penal") || t.includes("crime") || t.includes("tipicidade") || t.includes("culpabilidade")) return "Penal/Proc Penal";
  if (t.includes("direitos humanos") || t.includes("criminolog") || t.includes("pacto") || t.includes("tratado")) return "DH/Criminologia";
  if (t.includes("informatica") || t.includes("logica") || t.includes("rlm") || t.includes("rede") || t.includes("seguranca da informacao")) return "Informática/RLM";
  if (t.includes("seguranca") || t.includes("defesa pessoal") || t.includes("vigilancia") || t.includes("controle de acesso") || t.includes("escolta") || t.includes("incendio") || t.includes("socorrista") || t.includes("inteligencia")) return "Segurança Orgânica";
  if (t.includes("historia") || t.includes("geografia") || t.includes("brasil colonia") || t.includes("republica")) return "História";
  return "Administrativo";
}

function difficultyFor(text: string){
  const len = (text ?? "").length;
  if (len < 220) return 2 as const;
  if (len < 360) return 3 as const;
  if (len < 520) return 4 as const;
  return 5 as const;
}

function toQuestion(bank: BankQuestion): Question {
  const discipline = inferDiscipline(bank.source ?? null, bank.statement, (bank as any).subject ?? null);
  const subject = (bank as any).subject || bank.source || "Geral";
  const topic = (bank as any).subject || bank.source || "Geral";
  const options: Question["options"] = [];
  const choiceMap = bank.choices || { a: "", b: "", c: "", d: "" };
  const entries: Array<["A"|"B"|"C"|"D"|"E", string | undefined]> = [
    ["A", choiceMap.a],
    ["B", choiceMap.b],
    ["C", choiceMap.c],
    ["D", choiceMap.d],
    ["E", choiceMap.e]
  ];
  entries.forEach(([key, text]) => {
    if (text != null && String(text).trim() !== ""){
      options.push({ key, text: String(text) });
    }
  });
  const answer = bank.answer ? bank.answer.toUpperCase() as "A"|"B"|"C"|"D"|"E" : null;
  const hasAnswer = !!answer;
  const isTF = options.length <= 2;

  return {
    id: bank.id,
    discipline,
    subject,
    topic,
    difficulty: difficultyFor(bank.statement),
    type: isTF ? "TF" : "MCQ",
    style: "FGV",
    statement: bank.statement,
    options,
    correctKey: (answer ?? "A") as "A"|"B"|"C"|"D"|"E",
    hasAnswer,
    explanation: {
      summary: hasAnswer ? "Gabarito disponível no banco." : "Treino sem gabarito disponível para esta questão.",
      whyCorrect: hasAnswer ? "Alternativa correta conforme gabarito." : "Sem gabarito para correção automática.",
      whyWrong: {},
      tips: ["Leia todas as alternativas antes de responder."]
    }
  };
}

export const questionBankPack: QuestionPack = {
  id: "question-bank",
  name: "Banco principal (question_bank)",
  discipline: "Misto",
  questions: BANK_QUESTIONS.map(toQuestion)
};
