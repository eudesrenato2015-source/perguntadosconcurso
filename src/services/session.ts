import type { RunSession, RunMode, Discipline } from "../types";
import { uid } from "../lib/uid";
import { safeGet, safeSet, safeRemove } from "../lib/storage";

const KEY = "rota190:run";

export function getSession(): RunSession | null{
  const raw = safeGet(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as RunSession; } catch { return null; }
}

export function setSession(s: RunSession){
  safeSet(KEY, JSON.stringify(s));
}

export function clearSession(){
  safeRemove(KEY);
}

export function newSession(
  mode: RunMode,
  queue: string[],
  seed?: { discipline?: Discipline; label?: string },
  meta?: Record<string, unknown>
): RunSession{
  const s: RunSession = {
    id: uid("run"),
    mode,
    createdAt: Date.now(),
    queue,
    index: 0,
    seed: seed ?? {},
    meta
  };
  setSession(s);
  return s;
}

export function advanceSession(){
  const s = getSession();
  if (!s) return null;
  const next = { ...s, index: s.index + 1 };
  setSession(next);
  return next;
}

export function patchSession(patch: Partial<RunSession>){
  const s = getSession();
  if (!s) return null;
  const next = { ...s, ...patch };
  setSession(next);
  return next;
}
