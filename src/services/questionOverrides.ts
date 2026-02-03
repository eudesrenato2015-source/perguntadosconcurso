import { getSupabase, onlineEnabled } from "./online";
import { safeGet, safeSet } from "../lib/storage";
import type { Question } from "../types";

export type QuestionPatch = Partial<Omit<Question, "id">> & { id: string; deleted?: boolean };

const STORAGE_KEY = "rota190:questionOverrides";
let overrides = new Map<string, QuestionPatch>();
let customQuestions: Question[] = [];
let version = 0;
const listeners = new Set<(v: number) => void>();

function bump(){
  version += 1;
  listeners.forEach((fn) => fn(version));
}

function persist(){
  const payload = Array.from(overrides.values());
  safeSet(STORAGE_KEY, JSON.stringify(payload));
}

function loadFromStorage(){
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as QuestionPatch[];
    if (!Array.isArray(parsed)) return;
    overrides = new Map(parsed.map((item) => [item.id, item]));
  } catch {
    // ignore
  }
}

export function getCustomQuestions(){
  return customQuestions;
}

export function getOverridesVersion(){
  return version;
}

export function onOverridesChange(handler: (v: number)=>void){
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

export function getOverride(id: string){
  return overrides.get(id) ?? null;
}

export function applyQuestionOverride(q: Question): Question | null{
  const patch = overrides.get(q.id);
  if (!patch) return q;
  if (patch.deleted) return null;
  return {
    ...q,
    ...patch,
    explanation: patch.explanation ? { ...q.explanation, ...patch.explanation } : q.explanation
  };
}

export async function loadQuestionOverrides(){
  loadFromStorage();
  if (overrides.size){
    bump();
  }
  if (!onlineEnabled()) return overrides;
  const supa = getSupabase();
  if (!supa) return overrides;
  const { data, error } = await supa
    .from("question_overrides")
    .select("id, patch, updated_at, updated_by");
  if (error){
    console.error("[overrides] fetch failed", error.message ?? error);
    return overrides;
  }
  overrides = new Map((data ?? []).map((row: any) => [row.id, { id: row.id, ...(row.patch ?? {}) }]));
  persist();
  bump();
  return overrides;
}

export function subscribeQuestionOverrides(){
  if (!onlineEnabled()) return () => {};
  const supa = getSupabase();
  if (!supa) return () => {};
  const channel = supa.channel("question-overrides");
  channel.on("postgres_changes", { event: "*", schema: "public", table: "question_overrides" }, (payload) => {
    if (payload.eventType === "DELETE"){
      if (payload.old?.id) overrides.delete(payload.old.id);
    } else if (payload.new?.id){
      overrides.set(payload.new.id, { id: payload.new.id, ...(payload.new.patch ?? {}) });
    }
    persist();
    bump();
  });
  channel.subscribe();
  return () => { channel.unsubscribe(); };
}

export async function upsertQuestionOverride(patch: QuestionPatch){
  if (!onlineEnabled()) throw new Error("Supabase não configurado.");
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase não inicializado.");
  const { data, error } = await supa
    .from("question_overrides")
    .upsert({ id: patch.id, patch }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  overrides.set(patch.id, patch);
  persist();
  bump();
  return data;
}

export async function deleteQuestionOverride(id: string){
  if (!onlineEnabled()) throw new Error("Supabase não configurado.");
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase não inicializado.");
  const { error } = await supa
    .from("question_overrides")
    .delete()
    .eq("id", id);
  if (error) throw error;
  overrides.delete(id);
  persist();
  bump();
}


export async function loadQuestionCustoms(){
  if (!onlineEnabled()) return customQuestions;
  const supa = getSupabase();
  if (!supa) return customQuestions;
  const { data, error } = await supa
    .from("question_customs")
    .select("id, data, updated_at, created_by");
  if (error){
    console.error("[custom] fetch failed", error.message ?? error);
    return customQuestions;
  }
  customQuestions = (data ?? []).map((row: any) => row.data as Question);
  bump();
  return customQuestions;
}

export function subscribeQuestionCustoms(){
  if (!onlineEnabled()) return () => {};
  const supa = getSupabase();
  if (!supa) return () => {};
  const channel = supa.channel("question-customs");
  channel.on("postgres_changes", { event: "*", schema: "public", table: "question_customs" }, (payload) => {
    if (payload.eventType === "DELETE"){
      if (payload.old?.id){
        customQuestions = customQuestions.filter(q => q.id !== payload.old.id);
      }
    } else if (payload.new?.data){
      const data = payload.new.data as Question;
      customQuestions = [data, ...customQuestions.filter(q => q.id !== data.id)];
    }
    bump();
  });
  channel.subscribe();
  return () => { channel.unsubscribe(); };
}

export async function upsertQuestionCustom(question: Question){
  if (!onlineEnabled()) throw new Error("Supabase n?o configurado.");
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase n?o inicializado.");
  const { data, error } = await supa
    .from("question_customs")
    .upsert({ id: question.id, data: question }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  customQuestions = [question, ...customQuestions.filter(q => q.id !== question.id)];
  bump();
  return data;
}

export async function deleteQuestionCustom(id: string){
  if (!onlineEnabled()) throw new Error("Supabase n?o configurado.");
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase n?o inicializado.");
  const { error } = await supa
    .from("question_customs")
    .delete()
    .eq("id", id);
  if (error) throw error;
  customQuestions = customQuestions.filter(q => q.id !== id);
  bump();
}
