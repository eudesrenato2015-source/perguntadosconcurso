import { QUESTIONS, type Question as BankQuestion } from "../data/question_bank";
import { safeGet, safeSet } from "../lib/storage";

export type ChoiceKey = "a"|"b"|"c"|"d"|"e";
export type GradeInput = { id: string; marked: ChoiceKey | null | undefined };
export type GradeResult = { correct: boolean; answer: ChoiceKey | null; marked: ChoiceKey | null };
export type BatchStats = { total: number; correct: number; wrong: number; accuracy: number; ungraded: number };

export type HistoryEntry = {
  id: string;
  marked: ChoiceKey | null;
  answer: ChoiceKey | null;
  correct: boolean | null;
  timestamp: number;
  subject: string | null;
};

type HistoryStore = Record<string, HistoryEntry>;

export type SubjectMetrics = {
  subject: string;
  correct: number;
  wrong: number;
  last20: HistoryEntry[];
};

type MetricsStore = Record<string, SubjectMetrics>;

const HISTORY_KEY = "rota190:bankHistory";
const METRICS_KEY = "rota190:bankMetrics";

function loadHistory(): HistoryStore {
  const raw = safeGet(HISTORY_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as HistoryStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHistory(store: HistoryStore){
  safeSet(HISTORY_KEY, JSON.stringify(store));
}

function loadMetrics(): MetricsStore {
  const raw = safeGet(METRICS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MetricsStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMetrics(store: MetricsStore){
  safeSet(METRICS_KEY, JSON.stringify(store));
}

function normalizeKey(k: any): ChoiceKey | null {
  const key = String(k ?? "").trim().toLowerCase();
  if (key === "a" || key === "b" || key === "c" || key === "d" || key === "e") return key;
  return null;
}

export function getAll(): BankQuestion[]{
  return QUESTIONS;
}

export function getById(id: string): BankQuestion | undefined {
  return QUESTIONS.find(q => q.id === id);
}

export function getBySubject(subject: string): BankQuestion[]{
  const target = subject.toLowerCase();
  return QUESTIONS.filter(q => {
    const src = `${q.source ?? ""} ${q.statement ?? ""}`.toLowerCase();
    return src.includes(target);
  });
}

export function getRandom({ subject, n }: { subject?: string; n?: number } = {}): BankQuestion[]{
  const pool = subject ? getBySubject(subject) : QUESTIONS;
  const count = Math.max(1, Math.min(n ?? 1, pool.length));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function grade({ id, marked }: GradeInput): GradeResult {
  const q = getById(id);
  const answer = normalizeKey(q?.answer ?? null);
  const m = normalizeKey(marked);
  const correct = answer ? m === answer : false;
  const entry: HistoryEntry = {
    id,
    marked: m,
    answer,
    correct: answer ? correct : null,
    timestamp: Date.now(),
    subject: q?.source ?? null
  };

  const history = loadHistory();
  history[id] = entry;
  saveHistory(history);

  if (answer){
    const metrics = loadMetrics();
    const key = (q?.source ?? "Geral").toLowerCase();
    const current = metrics[key] ?? { subject: q?.source ?? "Geral", correct: 0, wrong: 0, last20: [] };
    if (correct) current.correct += 1; else current.wrong += 1;
    current.last20 = [...current.last20, entry].slice(-20);
    metrics[key] = current;
    saveMetrics(metrics);
  }

  return { correct, answer, marked: m };
}

export function gradeBatch(items: GradeInput[]): BatchStats {
  let correct = 0;
  let wrong = 0;
  let ungraded = 0;
  items.forEach(item => {
    const q = getById(item.id);
    const answer = normalizeKey(q?.answer ?? null);
    if (!answer){
      grade(item);
      ungraded += 1;
      return;
    }
    const res = grade(item);
    if (res.correct) correct += 1; else wrong += 1;
  });
  const total = correct + wrong;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, wrong, accuracy, ungraded };
}

export function getHistory(): HistoryEntry[]{
  const store = loadHistory();
  return Object.values(store).sort((a, b) => b.timestamp - a.timestamp);
}

export function getMetrics(): SubjectMetrics[]{
  const store = loadMetrics();
  return Object.values(store);
}
