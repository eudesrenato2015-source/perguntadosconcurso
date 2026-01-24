import type { Discipline, ExamStyle, Question } from "../types";
import { getActiveQuestions } from "./packs";
import { dueSR, listAttempts } from "./db";

export async function buildDailyQueue(count = 10){
  const pool = getActiveQuestions();
  if (!pool.length) return [];
  const poolIds = new Set(pool.map(q => q.id));
  const sr = (await dueSR(Date.now(), Math.min(30, count))).filter(item => poolIds.has(item.questionId));
  const attempts = await listAttempts(400);
  const wrongRecent = attempts.filter(a => !a.isCorrect && poolIds.has(a.questionId)).slice(0, 80).map(a => a.questionId);

  const uniq: string[] = [];
  const push = (id: string) => { if (!uniq.includes(id)) uniq.push(id); };
  sr.forEach(i => push(i.questionId));
  wrongRecent.forEach(push);

  const shuffled = [...pool.map(q=>q.id)].sort(()=>Math.random()-0.5);
  for (const id of shuffled){ if (uniq.length >= count) break; push(id); }
  return uniq.slice(0, count);
}

export async function buildRecommendedQueue(count = 12){
  const pool = getActiveQuestions();
  if (!pool.length) return [];
  const poolMap = new Map(pool.map(q => [q.id, q] as const));

  const sr = await dueSR(Date.now(), Math.min(40, count));
  const attempts = await listAttempts(800);

  const topicStats = new Map<string, { ok: number; total: number }>();
  attempts.forEach(att => {
    const q = poolMap.get(att.questionId);
    if (!q) return;
    const key = `${q.discipline}::${q.topic}`;
    const cur = topicStats.get(key) ?? { ok: 0, total: 0 };
    cur.total += 1;
    if (att.isCorrect) cur.ok += 1;
    topicStats.set(key, cur);
  });

  const weakTopics = Array.from(topicStats.entries())
    .map(([key, stat]) => ({ key, acc: stat.total ? stat.ok / stat.total : 0, total: stat.total }))
    .sort((a,b) => a.acc - b.acc)
    .slice(0, 8)
    .map(item => item.key);

  const weakSet = new Set(weakTopics);
  const weakIds = pool.filter(q => weakSet.has(`${q.discipline}::${q.topic}`)).map(q => q.id);
  const wrongRecent = attempts.filter(a => !a.isCorrect).slice(0, 80).map(a => a.questionId);

  const uniq: string[] = [];
  const push = (id: string) => { if (!uniq.includes(id)) uniq.push(id); };
  sr.forEach(i => push(i.questionId));
  weakIds.forEach(push);
  wrongRecent.forEach(push);

  const shuffled = [...pool.map(q => q.id)].sort(()=>Math.random()-0.5);
  for (const id of shuffled){ if (uniq.length >= count) break; push(id); }
  return uniq.slice(0, count);
}

export function pickByDiscipline(discipline: Discipline, count = 5, opts?: { shuffle?: boolean }){
  const ids = getActiveQuestions().filter(q => q.discipline === discipline).map(q => q.id);
  const doShuffle = opts?.shuffle ?? true;
  if (doShuffle) ids.sort(()=>Math.random()-0.5);
  return ids.slice(0, count);
}

export function filterQuestions(opts: {
  q?: string;
  discipline?: Discipline | "Todas";
  topic?: string | "Todos" | "Todas";
  type?: "MCQ"|"TF"|"Todas";
  difficulty?: number | "Todas";
  style?: "Todas" | ExamStyle;
  pool?: Question[];
}): Question[]{
  const q = (opts.q ?? "").trim().toLowerCase();
  const base = opts.pool ?? getActiveQuestions();
  return base.filter(item => {
    if (opts.discipline && opts.discipline !== "Todas" && item.discipline !== opts.discipline) return false;
    if (opts.topic && opts.topic !== "Todos" && opts.topic !== "Todas" && item.topic !== opts.topic) return false;
    if (opts.type && opts.type !== "Todas" && item.type !== opts.type) return false;
    if (opts.difficulty && opts.difficulty !== "Todas" && item.difficulty !== opts.difficulty) return false;
    if (opts.style && opts.style !== "Todas" && item.style !== opts.style) return false;
    if (q){
      const blob = (item.statement + " " + item.subject + " " + item.topic).toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}
