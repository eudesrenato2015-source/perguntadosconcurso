import { getSupabase, onlineEnabled } from "./online";

export type AuthUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

export function canAuth(){
  return onlineEnabled();
}

export async function getAuthUser(): Promise<AuthUser | null>{
  const supa = getSupabase();
  if (!supa) return null;
  const { data } = await supa.auth.getUser();
  const user = data.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at)
  };
}

export function onAuthChange(handler: (user: AuthUser | null)=>void){
  const supa = getSupabase();
  if (!supa) return () => {};
  const { data } = supa.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (!u){ handler(null); return; }
    handler({ id: u.id, email: u.email ?? null, emailConfirmed: Boolean(u.email_confirmed_at) });
  });
  return () => { data.subscription.unsubscribe(); };
}

export async function signUp(email: string, password: string, dob: string){
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase não configurado.");
  const { data, error } = await supa.auth.signUp({
    email,
    password,
    options: {
      data: { dob },
      emailRedirectTo: window.location.origin + "/login"
    }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string){
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase não configurado.");
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(){
  const supa = getSupabase();
  if (!supa) return;
  await supa.auth.signOut();
}
