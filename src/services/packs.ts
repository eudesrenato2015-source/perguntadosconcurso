import type { Question, QuestionPack } from "../types";
import { safeGet, safeSet, safeRemove } from "../lib/storage";
import { applyQuestionOverride, getCustomQuestions } from "./questionOverrides";

function normalizeText(text: string){
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function questionKey(q: Question){
  const statement = normalizeText(q.statement ?? "");
  const options = (q.options ?? []).map(o => normalizeText(o.text)).join("|");
  return `${statement}::${options}`;
}

const BLOCK_KEY = "rota190:blockedQuestions";

function isValidQuestion(q: Question){
  if (!q.statement || !q.options || q.options.length < 2) return false;
  if (q.statement.includes("???")) return false;
  if (q.options.some(o => !o.text || o.text.includes("???"))) return false;
  const opts = q.options.map(o => normalizeText(o.text));
  if (opts.length !== new Set(opts).size) return false;
  return true;
}

function getBlockedSet(){
  const raw = safeGet(BLOCK_KEY);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function blockQuestion(id: string){
  const blocked = getBlockedSet();
  blocked.add(id);
  safeSet(BLOCK_KEY, JSON.stringify(Array.from(blocked)));
}

export function getBlockedQuestionIds(){
  return Array.from(getBlockedSet());
}
import { questionPacks } from "../data/packs";

const KEY = "rota190:activePacks";
const USER_KEY = "rota190:userPacks";

function loadUserPacks(): QuestionPack[]{
  const raw = safeGet(USER_KEY);
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
  const raw = safeGet(KEY);
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
    safeRemove(KEY);
    return;
  }
  safeSet(KEY, JSON.stringify(next));
}

export function getActivePacks(){
  const active = new Set(getActivePackIds());
  return getAllPacks().filter(p => active.has(p.id));
}

export function getActiveQuestions(): Question[]{
  const map = new Map<string, Question>();
  const blocked = getBlockedSet();
  getActivePacks().forEach(pack => {
    pack.questions.forEach(q => {
      const merged = applyQuestionOverride(q);
      if (!merged) return;
      if (!isValidQuestion(merged)) return;
      if (blocked.has(merged.id)) return;
      const key = questionKey(merged);
      if (!map.has(key)) map.set(key, merged);
    });
  });
  getCustomQuestions().forEach(q => {
    const merged = applyQuestionOverride(q);
    if (!merged) return;
    if (!isValidQuestion(merged)) return;
    if (blocked.has(merged.id)) return;
    const key = questionKey(merged);
    if (!map.has(key)) map.set(key, merged);
  });
  return Array.from(map.values());
}

export function getAllQuestions(): Question[]{
  const map = new Map<string, Question>();
  const blocked = getBlockedSet();
  getAllPacks().forEach(pack => {
    pack.questions.forEach(q => {
      const merged = applyQuestionOverride(q);
      if (!merged) return;
      if (!isValidQuestion(merged)) return;
      if (blocked.has(merged.id)) return;
      const key = questionKey(merged);
      if (!map.has(key)) map.set(key, merged);
    });
  });
  getCustomQuestions().forEach(q => {
    const merged = applyQuestionOverride(q);
    if (!merged) return;
    if (!isValidQuestion(merged)) return;
    if (blocked.has(merged.id)) return;
    const key = questionKey(merged);
    if (!map.has(key)) map.set(key, merged);
  });
  return Array.from(map.values());
}

export function addUserPack(pack: QuestionPack){
  const packs = loadUserPacks();
  const next = [...packs.filter(p => p.id !== pack.id), pack];
  safeSet(USER_KEY, JSON.stringify(next));
  const active = new Set(getActivePackIds());
  active.add(pack.id);
  setActivePackIds(Array.from(active));
}

export function removeUserPack(id: string){
  const packs = loadUserPacks().filter(p => p.id !== id);
  safeSet(USER_KEY, JSON.stringify(packs));
  const active = new Set(getActivePackIds());
  if (active.has(id)){
    active.delete(id);
    setActivePackIds(Array.from(active));
  }
}
