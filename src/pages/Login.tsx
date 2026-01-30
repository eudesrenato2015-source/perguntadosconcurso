import React, { useEffect, useState } from "react";
import { canAuth, getAuthUser, onAuthChange, signIn, signOut, signUp } from "../services/auth";
import { ensureProfile } from "../services/profile";

export default function Login(){
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [user, setUser] = useState<{ email: string | null; emailConfirmed: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAuthUser().then(u => u && setUser(u));
    return onAuthChange((u) => setUser(u));
  }, []);

  const handleSignUp = async () => {
    if (!email || !password || !dob) return setNotice("Preencha email, senha e data de nascimento.");
    setLoading(true);
    setNotice(null);
    try {
      await signUp(email, password, dob);
      setNotice("Cadastro criado. Confirme o email para ativar.");
    } catch (err: any){
      setNotice(err?.message ?? "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) return setNotice("Preencha email e senha.");
    setLoading(true);
    setNotice(null);
    try {
      await signIn(email, password);
      await ensureProfile();
      setNotice("Login realizado.");
    } catch (err: any){
      setNotice(err?.message ?? "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    setUser(null);
    setLoading(false);
  };

  if (!canAuth()){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Login</div>
        <div className="sub">Supabase não configurado.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Login</div>
      <div className="sub">Email e senha. Confirmação obrigatória.</div>

      <div className="sep" />

      {user && (
        <div className="kpi">
          <div style={{ fontWeight: 900 }}>{user.email}</div>
          <div className="sub">{user.emailConfirmed ? "Email confirmado" : "Confirme seu email para jogar online"}</div>
          <button className="btn" style={{ marginTop: 8 }} onClick={handleSignOut}>Sair</button>
        </div>
      )}

      {!user && (
        <div className="grid" style={{ gridTemplateColumns:"repeat(12, 1fr)" }}>
          <div style={{ gridColumn:"span 12" }}>
            <input className="input" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div style={{ gridColumn:"span 12" }}>
            <input className="input" placeholder="Senha" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <div style={{ gridColumn:"span 12" }}>
            <input className="input" placeholder="Data de nascimento" type="date" value={dob} onChange={(e)=>setDob(e.target.value)} />
          </div>
          <div style={{ gridColumn:"span 12" }} className="row">
            <button className="btn btnPrimary" onClick={handleSignUp} disabled={loading}>Criar conta</button>
            <button className="btn" onClick={handleSignIn} disabled={loading}>Entrar</button>
          </div>
        </div>
      )}

      {notice && <div className="pill" style={{ marginTop: 12, color:"var(--warn-500)" }}>{notice}</div>}
    </div>
  );
}
