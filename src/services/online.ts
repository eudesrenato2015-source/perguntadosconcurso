import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let duelChannel: RealtimeChannel | null = null;
let duelCode: string | null = null;
let duelHandlers: Array<(payload: any)=>void> = [];
let duelSubscribed = false;
let pendingPayloads: any[] = [];
const DEBUG = import.meta.env.VITE_DEBUG_DUEL === "1";

function logDebug(...args: any[]){
  if (DEBUG) console.log("[duel]", ...args);
}

export function onlineEnabled(){
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function getSupabase(){
  if (!onlineEnabled()) return null;
  if (!client){
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 20 } }
    });
  }
  return client;
}

function ensureChannel(code: string){
  if (duelChannel && duelCode === code) return duelChannel;
  if (duelChannel){
    duelChannel.unsubscribe();
  }
  const supa = getSupabase();
  if (!supa) return null;
  duelCode = code;
  duelSubscribed = false;
  pendingPayloads = [];
  duelChannel = supa.channel(`duel:${code}`, { config: { broadcast: { ack: true } } });
  duelChannel.on("broadcast", { event: "duel" }, (payload) => {
    duelHandlers.forEach(fn => fn(payload.payload));
  });
  duelChannel.subscribe((status) => {
    logDebug("channel:status", code, status);
    if (status === "SUBSCRIBED"){
      duelSubscribed = true;
      if (pendingPayloads.length){
        pendingPayloads.forEach((payload) => {
          duelChannel?.send({ type: "broadcast", event: "duel", payload });
        });
        pendingPayloads = [];
      }
    }
  });
  return duelChannel;
}

export function subscribeDuelEvents(code: string, handler: (payload: any)=>void){
  const channel = ensureChannel(code);
  if (!channel) return () => {};
  duelHandlers = [...duelHandlers, handler];
  return () => {
    duelHandlers = duelHandlers.filter(h => h !== handler);
  };
}

export function sendDuelEvent(code: string, payload: any){
  const channel = ensureChannel(code);
  if (!channel) return;
  if (!duelSubscribed){
    pendingPayloads.push(payload);
    return;
  }
  channel.send({ type: "broadcast", event: "duel", payload });
}

export function closeDuelChannel(){
  if (duelChannel){
    duelChannel.unsubscribe();
    duelChannel = null;
    duelCode = null;
    duelHandlers = [];
    duelSubscribed = false;
    pendingPayloads = [];
  }
}
