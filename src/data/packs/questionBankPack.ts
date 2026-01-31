import type { Question, QuestionPack, Discipline } from "../../types";
import { QUESTIONS as BANK_QUESTIONS, type Question as BankQuestion } from "../question_bank";

function stripAccents(text: string){
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferDiscipline(source?: string | null, statement?: string | null): Discipline {
  const src = `${source ?? ""} ${statement ?? ""}`.toLowerCase();
  const t = stripAccents(src);
  if (t.includes("portugues") || t.includes("lingua portuguesa")) return "Português";
  if (t.includes("constitucional") || t.includes("constituicao") || t.includes("cf")) return "Constitucional";
  if (t.includes("administrativo") || t.includes("licita") || t.includes("ato administrativo")) return "Administrativo";
  if (t.includes("penal") || t.includes("processo penal") || t.includes("crime")) return "Penal/Proc Penal";
  if (t.includes("direitos humanos") || t.includes("criminolog")) return "DH/Criminologia";
  if (t.includes("informatica") || t.includes("logica") || t.includes("rlm")) return "Informática/RLM";
  if (t.includes("seguranca")) return "Segurança Orgânica";
  if (t.includes("historia") || t.includes("geografia")) return "História";
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
  const discipline = inferDiscipline(bank.source ?? null, bank.statement);
  const subject = bank.source || "Geral";
  const topic = bank.source || "Geral";
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

  return {
    id: bank.id,
    discipline,
    subject,
    topic,
    difficulty: difficultyFor(bank.statement),
    type: "MCQ",
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
