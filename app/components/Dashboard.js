"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { distanceInMeters, getStoreConfig } from "@/lib/geo";

export default function Dashboard() {
  const supabase = getSupabase();
  const store = getStoreConfig();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("ponto");
  const [punchType, setPunchType] = useState("entrada");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [msg, setMsg] = useState("");
  const [todayPunches, setTodayPunches] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState([]);
  const [filters, setFilters] = useState({ employee: "", start: "", end: "" });
  const [newEmployee, setNewEmployee] = useState({ name:"", email:"", shift:"07:00 às 19:00", position:"Atendente" });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.href = "/";
      return;
    }
    setUser(auth.user);

    const { data: prof, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
    if (error || !prof || !prof.active) {
      setMsg("Usuário sem perfil ativo. Peça para o administrador vincular seu usuário na tabela profiles.");
      return;
    }
    setProfile(prof);
    await loadToday(auth.user.id);
    if (prof.role === "admin") {
      await loadEmployees();
      await loadReport();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function loadToday(userId) {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const { data } = await supabase
      .from("time_punches")
      .select("*")
      .eq("user_id", userId)
      .gte("punched_at", start.toISOString())
      .lte("punched_at", end.toISOString())
      .order("punched_at", { ascending:false });

    setTodayPunches(data || []);
  }

  function getLocation() {
    setMsg("Solicitando localização...");
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const d = distanceInMeters(lat, lon, store.latitude, store.longitude);
      setLocation({ latitude: lat, longitude: lon });
      setDistance(d);
      setMsg(`Localização capturada. Distância aproximada da loja: ${Math.round(d)}m.`);
    }, () => {
      setMsg("Não foi possível pegar a localização. Autorize o GPS do navegador.");
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  async function startCamera() {
    setMsg("");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    videoRef.current.srcObject = stream;
    setCameraOn(true);
  }

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      setMsg("Selfie capturada.");
    }, "image/jpeg", 0.85);
  }

  async function registerPunch() {
    if (!user || !profile) return;
    if (!location) {
      setMsg("Capture a localização antes de registrar o ponto.");
      return;
    }
    if (distance > store.radius) {
      setMsg(`Bloqueado: você está a ${Math.round(distance)}m da loja. Limite permitido: ${store.radius}m.`);
      return;
    }
    if (!photoBlob) {
      setMsg("Tire uma selfie antes de registrar o ponto.");
      return;
    }

    setMsg("Registrando ponto...");

    const fileName = `${user.id}/${Date.now()}-${punchType}.jpg`;
    const upload = await supabase.storage.from("ponto-selfies").upload(fileName, photoBlob, {
      contentType: "image/jpeg",
      upsert: false
    });

    if (upload.error) {
      setMsg("Erro ao enviar selfie: " + upload.error.message);
      return;
    }

    const { error } = await supabase.from("time_punches").insert([{
      user_id: user.id,
      type: punchType,
      latitude: location.latitude,
      longitude: location.longitude,
      distance_meters: Math.round(distance),
      selfie_path: fileName,
      note,
      device_info: navigator.userAgent
    }]);

    if (error) {
      setMsg("Erro ao registrar ponto: " + error.message);
      return;
    }

    await supabase.from("audit_logs").insert([{
      actor_id: user.id,
      action: "register_punch",
      entity: "time_punches",
      details: { type: punchType, distance_meters: Math.round(distance) }
    }]);

    setNote("");
    setPhotoBlob(null);
    setPhotoPreview("");
    await loadToday(user.id);
    setMsg("Ponto registrado com segurança.");
  }

  async function loadEmployees() {
    const { data } = await supabase.from("profiles").select("*").order("name");
    setEmployees(data || []);
  }

  async function addEmployee() {
    if (!newEmployee.name || !newEmployee.email) {
      setMsg("Informe nome e e-mail.");
      return;
    }

    const { error } = await supabase.from("profiles").insert([{
      id: crypto.randomUUID(),
      name: newEmployee.name,
      email: newEmployee.email,
      shift: newEmployee.shift,
      position: newEmployee.position,
      role: "employee",
      active: true
    }]);

    if (error) {
      setMsg("Erro ao cadastrar: " + error.message + ". Dica: para funcionário com login, o ID deve ser substituído pelo UID do Auth depois.");
      return;
    }

    setNewEmployee({ name:"", email:"", shift:"07:00 às 19:00", position:"Atendente" });
    await loadEmployees();
    setMsg("Funcionário pré-cadastrado. Agora crie o usuário no Supabase Auth e vincule pelo UID.");
  }

  async function loadReport() {
    let q = supabase
      .from("time_punches")
      .select("*, profiles:user_id(name,email,shift,position)")
      .order("punched_at", { ascending:false })
      .limit(500);

    if (filters.employee) q = q.eq("user_id", filters.employee);
    if (filters.start) q = q.gte("punched_at", filters.start + "T00:00:00");
    if (filters.end) q = q.lte("punched_at", filters.end + "T23:59:59");

    const { data, error } = await q;
    if (error) {
      setMsg("Erro no relatório: " + error.message);
      return;
    }
    setReport(data || []);
  }

  function exportCSV() {
    const rows = [["Data/Hora","Funcionário","E-mail","Turno","Tipo","Distância(m)","Observação"]];
    report.forEach(r => rows.push([
      new Date(r.punched_at).toLocaleString("pt-BR"),
      r.profiles?.name || "",
      r.profiles?.email || "",
      r.profiles?.shift || "",
      labelType(r.type),
      r.distance_meters || "",
      r.note || ""
    ]));
    const csv = rows.map(row => row.map(c => `"${String(c).replaceAll('"','""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-ponto-shell-cafe-v2.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function labelType(t) {
    return {
      entrada: "Entrada",
      saida_intervalo: "Saída intervalo",
      volta_intervalo: "Volta intervalo",
      saida: "Saída"
    }[t] || t;
  }

  if (!profile) {
    return (
      <>
        <Header logout={logout} />
        <main className="container"><div className="card">{msg || "Carregando..."}</div></main>
      </>
    );
  }

  return (
    <>
      <Header profile={profile} logout={logout} />

      <main className="container">
        <div className="tabs">
          <button className={tab==="ponto" ? "active btn-light" : "btn-light"} onClick={()=>setTab("ponto")}>Bater ponto</button>
          <button className={tab==="meus" ? "active btn-light" : "btn-light"} onClick={()=>setTab("meus")}>Meus registros</button>
          {profile.role === "admin" && <button className={tab==="relatorio" ? "active btn-light" : "btn-light"} onClick={()=>setTab("relatorio")}>Relatórios</button>}
          {profile.role === "admin" && <button className={tab==="funcionarios" ? "active btn-light" : "btn-light"} onClick={()=>setTab("funcionarios")}>Funcionários</button>}
        </div>

        {msg && <div className={"status " + (msg.includes("Erro") || msg.includes("Bloqueado") ? "err" : "ok")}>{msg}</div>}

        {tab === "ponto" && (
          <section className="card">
            <h2>Registrar ponto</h2>
            <div className="grid">
              <div>
                <label>Funcionário</label>
                <input value={profile.name} disabled />
              </div>
              <div>
                <label>Tipo de ponto</label>
                <select value={punchType} onChange={e=>setPunchType(e.target.value)}>
                  <option value="entrada">Entrada</option>
                  <option value="saida_intervalo">Saída intervalo</option>
                  <option value="volta_intervalo">Volta intervalo</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
            </div>

            <label>Observação</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Opcional" />

            <div className="grid">
              <div className="card" style={{boxShadow:"none", border:"1px solid #e5e7eb"}}>
                <h3>1. Localização</h3>
                <p className="small">Loja: {store.storeName}. Raio permitido: {store.radius}m.</p>
                <button className="btn-blue" onClick={getLocation}>Capturar localização</button>
                {distance !== null && <p>Distância: <strong>{Math.round(distance)}m</strong></p>}
              </div>

              <div className="card" style={{boxShadow:"none", border:"1px solid #e5e7eb"}}>
                <h3>2. Selfie</h3>
                <div className="actions">
                  <button className="btn-dark" onClick={startCamera}>Abrir câmera</button>
                  <button className="btn-blue" onClick={takePhoto}>Tirar selfie</button>
                </div>
                <div className="videoBox" style={{marginTop:10}}>
                  <video ref={videoRef} autoPlay playsInline muted />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                {photoPreview && <img src={photoPreview} alt="Selfie" style={{width:"100%",borderRadius:12,marginTop:10}} />}
              </div>
            </div>

            <button className="btn-green" onClick={registerPunch} style={{width:"100%", marginTop:12}}>Registrar ponto com segurança</button>
          </section>
        )}

        {tab === "meus" && (
          <section className="card">
            <h2>Meus registros de hoje</h2>
            <PunchTable rows={todayPunches} labelType={labelType} />
          </section>
        )}

        {tab === "relatorio" && profile.role === "admin" && (
          <section className="card">
            <h2>Relatórios</h2>
            <div className="grid3">
              <div>
                <label>Funcionário</label>
                <select value={filters.employee} onChange={e=>setFilters({...filters, employee:e.target.value})}>
                  <option value="">Todos</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label>Data inicial</label>
                <input type="date" value={filters.start} onChange={e=>setFilters({...filters, start:e.target.value})} />
              </div>
              <div>
                <label>Data final</label>
                <input type="date" value={filters.end} onChange={e=>setFilters({...filters, end:e.target.value})} />
              </div>
            </div>
            <div className="actions">
              <button className="btn-blue" onClick={loadReport}>Buscar</button>
              <button className="btn-green" onClick={exportCSV}>Exportar CSV</button>
            </div>

            <div className="grid3" style={{marginTop:12}}>
              <div className="kpi"><span>Registros</span><strong>{report.length}</strong></div>
              <div className="kpi"><span>Entradas</span><strong>{report.filter(r=>r.type==="entrada").length}</strong></div>
              <div className="kpi"><span>Saídas</span><strong>{report.filter(r=>r.type==="saida").length}</strong></div>
            </div>

            <PunchTable rows={report} labelType={labelType} admin />
          </section>
        )}

        {tab === "funcionarios" && profile.role === "admin" && (
          <section className="card">
            <h2>Funcionários</h2>
            <div className="grid">
              <div>
                <label>Nome</label>
                <input value={newEmployee.name} onChange={e=>setNewEmployee({...newEmployee, name:e.target.value})} />
              </div>
              <div>
                <label>E-mail</label>
                <input value={newEmployee.email} onChange={e=>setNewEmployee({...newEmployee, email:e.target.value})} />
              </div>
              <div>
                <label>Turno</label>
                <select value={newEmployee.shift} onChange={e=>setNewEmployee({...newEmployee, shift:e.target.value})}>
                  <option>00:00 às 07:00</option>
                  <option>07:00 às 19:00</option>
                  <option>19:00 às 00:00</option>
                </select>
              </div>
              <div>
                <label>Cargo</label>
                <input value={newEmployee.position} onChange={e=>setNewEmployee({...newEmployee, position:e.target.value})} />
              </div>
            </div>
            <button className="btn-green" onClick={addEmployee} style={{marginTop:12}}>Pré-cadastrar funcionário</button>
            <p className="small">Após cadastrar, crie o usuário no Supabase Auth e vincule o UID ao perfil.</p>

            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Turno</th><th>Cargo</th><th>Perfil</th><th>Status</th></tr></thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id}>
                    <td>{e.name}</td><td>{e.email}</td><td>{e.shift}</td><td>{e.position}</td><td>{e.role}</td><td>{e.active ? "Ativo" : "Inativo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}

function Header({ profile, logout }) {
  return (
    <div className="header">
      <h1>☕ Shell Café Ponto V2</h1>
      <p>{profile ? `${profile.name} | ${profile.role === "admin" ? "Administrador" : "Funcionário"}` : "Carregando"}</p>
      {profile && <button className="btn-dark" onClick={logout} style={{marginTop:10}}>Sair</button>}
    </div>
  );
}

function PunchTable({ rows, labelType, admin=false }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          {admin && <th>Funcionário</th>}
          <th>Tipo</th>
          <th>Distância</th>
          <th>Obs.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{new Date(r.punched_at).toLocaleString("pt-BR")}</td>
            {admin && <td>{r.profiles?.name || ""}<br/><span className="small">{r.profiles?.shift || ""}</span></td>}
            <td><span className="badge">{labelType(r.type)}</span></td>
            <td>{r.distance_meters ? `${Math.round(r.distance_meters)}m` : "-"}</td>
            <td>{r.note || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
