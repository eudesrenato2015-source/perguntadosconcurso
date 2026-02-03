import type { Discipline } from "../types";
import { uid } from "../lib/uid";
import { getSupabase, onlineEnabled } from "./online";
import { DISCIPLINES } from "../data/disciplines";

export type DuelRoomStatus = "waiting" | "ready" | "started" | "ended";

export type DuelRoomConfig = {
  discipline: Discipline;
  seed: number;
  length: number;
  mix: boolean;
};

export type DuelState = {
  turn: "host" | "guest";
  streak: { host: number; guest: number };
  crowns: Record<Discipline, { host: boolean; guest: boolean }>;
  disciplines?: Discipline[];
  current?: { questionId: string; category: Discipline; crown: boolean; player: "host"|"guest" };
  used: string[];
  pendingCrown?: { player: "host"|"guest"; reason: "streak"|"wheel" };
  chat?: { id: string; role: "host"|"guest"; text: string; at: number }[];
  powers: {
    host: { bomb: number; extraTime: number; skip: number; double: number };
    guest: { bomb: number; extraTime: number; skip: number; double: number };
  };
  stats: { host: { correct: number; total: number }; guest: { correct: number; total: number } };
  bags: { host: Discipline[]; guest: Discipline[] };
  recent: { host: Discipline[]; guest: Discipline[] };
};

export type DuelRoom = {
  code: string;
  host_id: string;
  guest_id: string | null;
  status: DuelRoomStatus;
  config: DuelRoomConfig;
  state: DuelState | null;
  version: number;
  winner_id?: string | null;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
};

const DEBUG = import.meta.env.VITE_DEBUG_DUEL === "1";
const CLIENT_KEY = "rota190:duelClientId";
const memoryStore = new Map<string, string>();

function safeGet(key: string){
  try { return localStorage.getItem(key); } catch { return memoryStore.get(key) ?? null; }
}
function safeSet(key: string, value: string){
  try { localStorage.setItem(key, value); } catch { memoryStore.set(key, value); }
}

function logDebug(...args: any[]){
  if (DEBUG) console.log("[duel]", ...args);
}

export function getDuelClientId(){
  const existing = safeGet(CLIENT_KEY);
  if (existing) return existing;
  const next = uid("duel");
  safeSet(CLIENT_KEY, next);
  return next;
}

function initialState(): DuelState{
  const crowns = {} as Record<Discipline, { host: boolean; guest: boolean }>;
  DISCIPLINES.forEach(d => { crowns[d] = { host: false, guest: false }; });
  return {
    disciplines: DISCIPLINES,
    turn: "host",
    streak: { host: 0, guest: 0 },
    crowns,
    current: undefined,
    used: [],
    pendingCrown: undefined,
    chat: [],
    powers: {
      host: { bomb: 2, extraTime: 2, skip: 2, double: 2 },
      guest: { bomb: 2, extraTime: 2, skip: 2, double: 2 }
    },
    stats: { host: { correct: 0, total: 0 }, guest: { correct: 0, total: 0 } },
    bags: { host: [], guest: [] },
    recent: { host: [], guest: [] }
  };
}

async function ensureOnline(){
  if (!onlineEnabled()) throw new Error("Duelo online desativado (env vars ausentes).");
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase não inicializado.");
  return supa;
}

export async function createRoomRecord(code: string, config: DuelRoomConfig, hostId: string){
  const supa = await ensureOnline();
  const { data, error } = await supa
    .from("duel_rooms")
    .upsert({ code, host_id: hostId, guest_id: null, status: "waiting", config, state: initialState(), version: 0 }, { onConflict: "code" })
    .select()
    .single();
  if (error) throw error;
  logDebug("room:create", data);
  return data as DuelRoom;
}

export async function joinRoomRecord(code: string, guestId: string){
  const supa = await ensureOnline();
  const { data, error } = await supa
    .from("duel_rooms")
    .update({ guest_id: guestId, status: "ready" })
    .eq("code", code)
    .select()
    .single();
  if (error) throw error;
  logDebug("room:join", data);
  return data as DuelRoom;
}

export async function startRoomRecord(code: string){
  const supa = await ensureOnline();
  const { data, error } = await supa
    .from("duel_rooms")
    .update({ status: "started", started_at: new Date().toISOString() })
    .eq("code", code)
    .select()
    .single();
  if (error) throw error;
  logDebug("room:start", data);
  return data as DuelRoom;
}

export async function updateRoomState(code: string, state: DuelState, version: number, winnerId?: string | null){
  const supa = await ensureOnline();
  const patch: any = { state, version: version + 1 };
  if (winnerId) patch.winner_id = winnerId, patch.status = "ended";
  const { data, error } = await supa
    .from("duel_rooms")
    .update(patch)
    .eq("code", code)
    .eq("version", version)
    .select()
    .single();
  if (error) throw error;
  logDebug("room:update", data);
  return data as DuelRoom;
}

export async function fetchRoomRecord(code: string){
  const supa = await ensureOnline();
  const { data, error } = await supa
    .from("duel_rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  logDebug("room:fetch", data);
  return data as DuelRoom | null;
}

export async function connectRoomChannel(code: string, onRoom: (room: DuelRoom)=>void, onBroadcast?: (payload: any)=>void){
  const supa = await ensureOnline();
  let subscribed = false;
  let resolveSub: ((v: void)=>void) | null = null;
  const subscribedPromise = new Promise<void>((resolve) => { resolveSub = resolve; });

  const channel = supa.channel(`duel-room:${code}`);
  channel.on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "duel_rooms",
    filter: `code=eq.${code}`
  }, (payload) => {
    if (payload.new){
      onRoom(payload.new as DuelRoom);
    }
  });
  if (onBroadcast){
    channel.on("broadcast", { event: "duel" }, (payload) => {
      onBroadcast(payload.payload);
    });
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED"){
      subscribed = true;
      logDebug("channel:subscribed", code);
      resolveSub?.();
    } else {
      logDebug("channel:status", code, status);
    }
  });

  const sendBroadcast = async (payload: any) => {
    if (!subscribed) await subscribedPromise;
    logDebug("broadcast:send", payload);
    channel.send({ type: "broadcast", event: "duel", payload });
  };

  return {
    channel,
    waitForSubscribed: () => subscribedPromise,
    sendBroadcast,
    unsubscribe: () => channel.unsubscribe()
  };
}
