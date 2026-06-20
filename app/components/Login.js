"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export default function Login() {
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function login(e) {
    e.preventDefault();
    setMsg("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <>
      <div className="header">
        <h1>☕ Shell Café Ponto V2</h1>
        <p>Sistema seguro com login, localização e selfie.</p>
      </div>

      <main className="container">
        <div className="card" style={{maxWidth: 460, margin: "40px auto"}}>
          <h2>Entrar</h2>
          <form onSubmit={login}>
            <label>E-mail</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
            <label>Senha</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required />
            <button className="btn-red" style={{width:"100%", marginTop:14}}>Acessar sistema</button>
          </form>
          {msg && <div className="status">{msg}</div>}
          <p className="small">Os usuários são criados no Supabase Auth. O perfil e permissão ficam na tabela profiles.</p>
        </div>
      </main>
    </>
  );
}
