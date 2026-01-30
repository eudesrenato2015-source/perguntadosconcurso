import { addXp } from "./profile";
import { onlineEnabled } from "./online";
import { safeGet, safeSet } from "../lib/storage";

export type PlayerState = {
  xp: number;
  xpSpent: number;
  level: number;
  streak: number;
  lastStreakDay?: string;
  totalAttempts: number;
  totalCorrect: number;
  totalTimeMs: number;
  unlockedThemes: string[];
  activeTheme: string;
};

const KEY = "rota190:progress";

const defaultState: PlayerState = {
  xp: 0,
  xpSpent: 0,
  level: 1,
  streak: 0,
  totalAttempts: 0,
  totalCorrect: 0,
  totalTimeMs: 0,
  unlockedThemes: ["dark", "light"],
  activeTheme: "dark"
};

function levelForXp(xp: number): number{
  let level = 1;
  let threshold = 120;
  while (xp >= threshold){
    level += 1;
    threshold = Math.round(120 * level * level * 0.85);
  }
  return level;
}

function todayKey(){
  return new Date().toISOString().slice(0,10);
}

function readState(): PlayerState{
  const raw = safeGet(KEY);
  if (!raw) return { ...defaultState };
  try {
    const parsed = JSON.parse(raw) as PlayerState;
    return { ...defaultState, ...parsed };
  } catch {
    return { ...defaultState };
  }
}

function emitThemeChange(themeId: string){
  if (typeof document !== "undefined"){
    document.documentElement.dataset.theme = themeId;
  }
  if (typeof window !== "undefined"){
    window.dispatchEvent(new CustomEvent("rota190:theme", { detail: themeId }));
  }
}

function writeState(next: PlayerState){
  safeSet(KEY, JSON.stringify(next));
}

export function getPlayerState(): PlayerState{
  return readState();
}

export function availableXp(state = readState()): number{
  return Math.max(0, state.xp - state.xpSpent);
}

export function awardBonusXp(amount: number){
  const state = readState();
  const gain = Math.max(0, Math.round(amount));
  state.xp += gain;
  state.level = levelForXp(state.xp);
  writeState(state);
  if (onlineEnabled()) void addXp(gain);
  return { gain, state };
}

export function awardAttemptXP({ isCorrect, timeSpentMs }: { isCorrect: boolean; timeSpentMs: number }){
  const state = readState();
  const day = todayKey();

  const last = state.lastStreakDay;
  if (last !== day){
    const lastDate = last ? new Date(last) : null;
    const today = new Date(day);
    const diff = lastDate ? Math.round((today.getTime() - lastDate.getTime()) / 86400000) : 0;
    if (diff === 1) state.streak += 1;
    else state.streak = 1;
    state.lastStreakDay = day;
  }

  const base = isCorrect ? 10 : 2;
  const speedBonus = isCorrect ? Math.max(0, Math.round((14000 - timeSpentMs) / 1400)) : 0;
  const streakBonus = Math.min(10, Math.floor(state.streak / 3));
  const gain = Math.max(1, base + speedBonus + streakBonus);

  state.xp += gain;
  state.totalAttempts += 1;
  if (isCorrect) state.totalCorrect += 1;
  state.totalTimeMs += timeSpentMs;
  state.level = levelForXp(state.xp);

  writeState(state);
  if (onlineEnabled()) void addXp(gain);
  return { gain, state };
}

export function unlockTheme(themeId: string): { ok: boolean; state: PlayerState }{
  const state = readState();
  if (state.unlockedThemes.includes(themeId)) return { ok: true, state };
  return { ok: false, state };
}

export function applyTheme(themeId: string){
  const state = readState();
  state.activeTheme = themeId;
  writeState(state);
  safeSet("rota190:theme", themeId);
  emitThemeChange(themeId);
  return state;
}

export function spendXp(amount: number): PlayerState{
  const state = readState();
  const avail = availableXp(state);
  if (amount > avail) return state;
  state.xpSpent += amount;
  writeState(state);
  return state;
}

export function grantTheme(themeId: string, cost: number): { ok: boolean; state: PlayerState }{
  const state = readState();
  if (state.unlockedThemes.includes(themeId)) return { ok: true, state };
  const avail = availableXp(state);
  if (avail < cost) return { ok: false, state };
  state.xpSpent += cost;
  state.unlockedThemes = [...state.unlockedThemes, themeId];
  writeState(state);
  return { ok: true, state };
}
