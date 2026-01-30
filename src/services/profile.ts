import { getSupabase } from "./online";
import type { Discipline } from "../types";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  dob: string | null;
  xp: number;
  crowns: Record<Discipline, boolean>;
  created_at?: string;
  updated_at?: string;
};

export type DailyXp = {
  user_id: string;
  day: string;
  xp: number;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

export async function ensureProfile(){
  const supa = getSupabase();
  if (!supa) return null;
  const { data: userData } = await supa.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data: existing } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return existing as Profile;

  const display = (user.email ?? "Jogador").split("@")[0];
  const { data, error } = await supa
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      display_name: display,
      dob: (user.user_metadata as any)?.dob ?? null,
      xp: 0,
      crowns: {}
    })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function addXp(amount: number){
  const supa = getSupabase();
  if (!supa) return null;
  const { data: userData } = await supa.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data: profile, error } = await supa
    .from("profiles")
    .select("xp")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  const nextXp = Number(profile.xp ?? 0) + amount;
  const { error: upErr } = await supa
    .from("profiles")
    .update({ xp: nextXp })
    .eq("id", user.id);
  if (upErr) throw upErr;

  const day = todayKey();
  const { data: daily } = await supa
    .from("daily_xp")
    .select("xp")
    .eq("user_id", user.id)
    .eq("day", day)
    .maybeSingle();
  const dailyXp = Number(daily?.xp ?? 0) + amount;
  await supa.from("daily_xp").upsert({ user_id: user.id, day, xp: dailyXp }, { onConflict: "user_id,day" });
  return nextXp;
}

export async function fetchDailyRanking(limit = 50){
  const supa = getSupabase();
  if (!supa) return [] as Array<{ display_name: string; xp: number }>;
  const day = todayKey();
  const { data, error } = await supa
    .from("daily_xp")
    .select("xp, profiles(display_name)")
    .eq("day", day)
    .order("xp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ display_name: row.profiles?.display_name ?? "Jogador", xp: row.xp }));
}

export async function fetchPeriodRanking(days: number, limit = 50){
  const supa = getSupabase();
  if (!supa) return [] as Array<{ display_name: string; xp: number }>;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const startKey = start.toISOString().slice(0, 10);
  const { data, error } = await supa
    .from("daily_xp")
    .select("user_id, xp, day, profiles(display_name)")
    .gte("day", startKey);
  if (error) throw error;
  const map = new Map<string, { display_name: string; xp: number }>();
  (data ?? []).forEach((row: any) => {
    const id = row.user_id;
    const prev = map.get(id) ?? { display_name: row.profiles?.display_name ?? "Jogador", xp: 0 };
    map.set(id, { display_name: prev.display_name, xp: prev.xp + Number(row.xp ?? 0) });
  });
  return Array.from(map.values()).sort((a, b) => b.xp - a.xp).slice(0, limit);
}
