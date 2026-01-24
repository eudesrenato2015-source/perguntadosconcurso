import type { Discipline } from "../types";

export type DistrictProgress = {
  level: number;
  bossDefeated: boolean;
  lastResult?: "win" | "lose";
  lastPlayedAt?: number;
};

export type CampaignState = Record<Discipline, DistrictProgress>;

const KEY = "rota190:campaign";
export const CAMPAIGN_LEVELS = 3;

const disciplines: Discipline[] = [
  "Português",
  "Constitucional",
  "Administrativo",
  "Penal/Proc Penal",
  "DH/Criminologia",
  "Informática/RLM"
];

function blankProgress(): CampaignState{
  const base: CampaignState = {} as CampaignState;
  disciplines.forEach((d) => {
    base[d] = { level: 0, bossDefeated: false };
  });
  return base;
}

function readState(): CampaignState{
  const raw = localStorage.getItem(KEY);
  if (!raw) return blankProgress();
  try {
    const parsed = JSON.parse(raw) as CampaignState;
    const base = blankProgress();
    disciplines.forEach((d) => {
      if (parsed?.[d]){
        base[d] = { ...base[d], ...parsed[d] };
      }
    });
    return base;
  } catch {
    return blankProgress();
  }
}

function writeState(state: CampaignState){
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getCampaignState(): CampaignState{
  return readState();
}

export function recordCampaignResult({
  discipline,
  level,
  boss,
  won
}: {
  discipline: Discipline;
  level: number;
  boss?: boolean;
  won: boolean;
}){
  const state = readState();
  const current = state[discipline] ?? { level: 0, bossDefeated: false };
  let leveledUp = false;
  let bossUnlocked = false;
  let bossDefeated = current.bossDefeated;
  let nextLevel = current.level;

  if (boss){
    if (won) bossDefeated = true;
  } else if (won && level > current.level){
    nextLevel = level;
    leveledUp = true;
    bossUnlocked = nextLevel >= CAMPAIGN_LEVELS;
  }

  state[discipline] = {
    ...current,
    level: nextLevel,
    bossDefeated,
    lastResult: won ? "win" : "lose",
    lastPlayedAt: Date.now()
  };

  writeState(state);
  return { state, leveledUp, bossUnlocked, bossDefeated };
}


