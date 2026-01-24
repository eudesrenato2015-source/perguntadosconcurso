import type { Question, QuestionPack } from "../types";
import { questionPacks } from "../data/packs";

const KEY = "rota190:activePacks";
const USER_KEY = "rota190:userPacks";

function loadUserPacks(): QuestionPack[]{
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QuestionPack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getUserPacks(): QuestionPack[]{
  return loadUserPacks();
}

export function getAllPacks(): QuestionPack[]{
  return [...questionPacks, ...loadUserPacks()];
}

function packIdSet(){
  return new Set(getAllPacks().map(p => p.id));
}

function normalizeIds(raw: unknown): string[]{
  if (!Array.isArray(raw)) return [];
  const ids = packIdSet();
  return raw.filter((id): id is string => typeof id === "string" && ids.has(id));
}

export function getActivePackIds(): string[]{
  const raw = localStorage.getItem(KEY);
  const allPackIds = getAllPacks().map(p => p.id);
  if (!raw) return allPackIds;
  try {
    const parsed = JSON.parse(raw);
    const ids = normalizeIds(parsed);
    return ids.length ? ids : allPackIds;
  } catch {
    return allPackIds;
  }
}

export function setActivePackIds(ids: string[]){
  const next = normalizeIds(ids);
  if (!next.length){
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getActivePacks(){
  const active = new Set(getActivePackIds());
  return getAllPacks().filter(p => active.has(p.id));
}

export function getActiveQuestions(): Question[]{
  const map = new Map<string, Question>();
  getActivePacks().forEach(pack => {
    pack.questions.forEach(q => {
      if (!map.has(q.id)) map.set(q.id, q);
    });
  });
  return Array.from(map.values());
}

export function getAllQuestions(): Question[]{
  const map = new Map<string, Question>();
  getAllPacks().forEach(pack => {
    pack.questions.forEach(q => {
      if (!map.has(q.id)) map.set(q.id, q);
    });
  });
  return Array.from(map.values());
}

export function addUserPack(pack: QuestionPack){
  const packs = loadUserPacks();
  const next = [...packs.filter(p => p.id !== pack.id), pack];
  localStorage.setItem(USER_KEY, JSON.stringify(next));
  const active = new Set(getActivePackIds());
  active.add(pack.id);
  setActivePackIds(Array.from(active));
}

export function removeUserPack(id: string){
  const packs = loadUserPacks().filter(p => p.id !== id);
  localStorage.setItem(USER_KEY, JSON.stringify(packs));
  const active = new Set(getActivePackIds());
  if (active.has(id)){
    active.delete(id);
    setActivePackIds(Array.from(active));
  }
}
