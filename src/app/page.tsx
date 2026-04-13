"use client";

import React, { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, FileText, AlertCircle, AlertTriangle, RefreshCcw, CheckCircle2, MapPin, Shield, Activity, Clock, Vote, Landmark, Building2 } from "lucide-react";

const fmt = (n: number) => n?.toLocaleString("es-PE") || "0";
const fmtM = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : "0";

interface Candidate { id: number; name: string; party: string; votes: number; percent?: number; color: string; }
interface PartyResult { name: string; candidates?: number; validPercent?: number; emitPercent?: number; votes: number; color: string; }
interface ElectionData {
  timestamp: number; status: string; percentCounted: number; isExitPoll?: boolean;
  candidates: Candidate[]; totals: { valid: number; blank: number; null: number; total: number };
  actasProcessed?: number; actasTotal?: number; actasPending?: number;
  senadoresUnico?: { parties?: PartyResult[]; percent?: number; totalActas?: number };
  senadoresMultiple?: { parties?: PartyResult[]; percent?: number; totalActas?: number };
  diputados?: { parties?: PartyResult[]; percent?: number; totalActas?: number };
  parlamentoAndino?: { parties?: PartyResult[]; percent?: number; totals?: { validVotes: number; blankVotes: number; nullVotes: number; totalVotes: number } };
  participacion?: { electoresHabiles: number; totalAsistentes: number; totalAusentes: number; asistentesPercent: number; ausentesPercent: number; pendientesPercent: number; exteriorAsistentes: number; peruAsistentes: number };
  actasSummary?: Record<string, { total: number; percent: number; processed: number; pending: number; pendingPercent: number }>;
  lastUpdate?: string;
}

const TABS = [
  { id: "presidenciales", icon: Vote, label: "Presidenciales", color: "bg-blue-600" },
  { id: "senadores", icon: Landmark, label: "Senadores", color: "bg-purple-600" },
  { id: "diputados", icon: Building2, label: "Diputados", color: "bg-indigo-600" },
  { id: "parlamento", icon: MapPin, label: "Parl. Andino", color: "bg-pink-600" },
  { id: "participacion", icon: Users, label: "Participación", color: "bg-emerald-600" },
  { id: "actas", icon: FileText, label: "Actas", color: "bg-amber-600" },
  { id: "corrupcion", icon: Shield, label: "Corrupción", color: "bg-red-600" },
];

export default function ElectoralDashboard() {
  const [data, setData] = useState<ElectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("presidenciales");
  const [lastRefresh, setLastRefresh] = useState("");
  const [senadorTab, setSenadorTab] = useState<"unico" | "multiple">("unico");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      const json = await res.json();
      if (json.current) { setData(json.current); setError(null); setLastRefresh(new Date().toLocaleTimeString("es-PE")); }
      else setError(json.message || "Esperando datos...");
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, []);

  if (loading && !data) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><RefreshCcw className="w-12 h-12 text-blue-500 animate-spin" /><p className="text-white ml-4">Sincronizando con ONPE...</p></div>;
  if (error && !data) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><div className="text-center"><AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" /><h2 className="text-xl font-semibold text-white mb-2">Esperando Datos</h2><p className="text-zinc-400">{error}</p><button onClick={fetchData} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">Reintentar</button></div></div>;
  if (!data) return null;

  const barData = (data.candidates || []).map(c => ({ name: c.name.split(" ").slice(-2).join(" "), fullName: c.name, party: c.party, votos: c.votes, color: c.color, percent: c.percent || 0 }));

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-3 md:p-6 space-y-4">
      {/* HEADER */}
      <header className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-zinc-800 p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic">Electoral <span className="text-red-500">Perú</span> <span className="text-zinc-500">2026</span></h1>
            <span className={data.isExitPoll ? "px-3 py-1 bg-amber-600/30 text-amber-300 text-[10px] font-bold rounded-full border border-amber-500/30 uppercase" : "px-3 py-1 bg-emerald-600/30 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/30 uppercase"}>{data.isExitPoll ? "BOCA DE URNA" : "ONPE OFICIAL"}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <Clock className="w-3 h-3 inline" /> {lastRefresh} | Auto: 30s
            <button onClick={fetchData} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"><RefreshCcw className="w-3 h-3" /> Actualizar</button>
          </div>
        </div>
        <p className="text-zinc-500 text-sm mt-2">{data.status} {data.lastUpdate ? `• ${data.lastUpdate}` : ""} • Actas: {data.percentCounted}% ({data.actasProcessed || 0}/{data.actasTotal || 92766})</p>
      </header>

      {/* TABS */}
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeTab === t.id ? `${t.color} text-white shadow-lg` : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </nav>

      {/* ============ PRESIDENCIALES ============ */}
      {activeTab === "presidenciales" && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Votos Válidos", value: fmtM(data.totals?.valid || 0), icon: CheckCircle2, color: "text-blue-400" },
              { label: "Votos Nulos", value: fmtM(data.totals?.null || 0), icon: AlertCircle, color: "text-red-400" },
              { label: "Votos Blancos", value: fmtM(data.totals?.blank || 0), icon: FileText, color: "text-zinc-400" },
              { label: "Total Votos", value: fmtM(data.totals?.total || 0), icon: TrendingUp, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 flex items-center gap-3">
                <s.icon className={s.color + " w-8 h-8"} />
                <div><p className="text-[10px] text-zinc-500 uppercase">{s.label}</p><p className="text-xl font-black text-white">{s.value}</p></div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4 md:p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-red-500" /> Resultados Presidenciales</h2>
            <ResponsiveContainer width="100%" height={Math.max(400, barData.length * 36)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 50 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 11, fontWeight: 'bold' }} width={50} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} formatter={(v: unknown, _n: unknown, p: any) => [`${fmt(v as number)} votos (${p.payload.percent}%)`, p.payload.fullName]} />
                <Bar dataKey="votos" radius={[0, 6, 6, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={i === 0 ? 1 : 0.65} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table with percentages */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Detalle por Candidato</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800">
                  <th className="text-left p-3">#</th><th className="text-left p-3">Candidato</th>
                  <th className="text-right p-3">Votos</th><th className="text-right p-3">% Válidos</th><th className="text-left p-3 w-32">Barra</th>
                </tr></thead>
                <tbody>{barData.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 font-bold text-zinc-400">{i + 1}</td>
                    <td className="p-3"><div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <div><p className="font-semibold text-white">{c.fullName}</p><p className="text-[10px] text-zinc-500">{c.party}</p></div>
                    </div></td>
                    <td className="p-3 text-right font-mono text-white font-bold">{fmt(c.votos)}</td>
                    <td className="p-3 text-right font-bold" style={{ color: c.color }}>{c.percent}%</td>
                    <td className="p-3"><div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(c.percent, 0.5)}%`, backgroundColor: c.color }} />
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ SENADORES ============ */}
      {activeTab === "senadores" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setSenadorTab("unico")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${senadorTab === "unico" ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>D.E. Único (Nacional)</button>
            <button onClick={() => setSenadorTab("multiple")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${senadorTab === "multiple" ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>D.E. Múltiple (Regional)</button>
          </div>
          {senadorTab === "unico" && <SenateSection data={data.senadoresUnico} title="Senadores - Distrito Electoral Único Nacional" />}
          {senadorTab === "multiple" && <SenateSection data={data.senadoresMultiple} title="Senadores - Distrito Electoral Múltiple Regional" />}
        </div>
      )}

      {/* ============ DIPUTADOS ============ */}
      {activeTab === "diputados" && <SenateSection data={data.diputados} title="Diputados" />}

      {/* ============ PARLAMENTO ANDINO ============ */}
      {activeTab === "parlamento" && <ParlamentoSection data={data.parlamentoAndino} />}

      {/* ============ PARTICIPACION ============ */}
      {activeTab === "participacion" && data.participacion && <ParticipacionSection data={data.participacion} />}

      {/* ============ ACTAS ============ */}
      {activeTab === "actas" && data.actasSummary && <ActasSection data={data.actasSummary} />}

      {/* ============ CORRUPCION ============ */}
      {activeTab === "corrupcion" && <CorrupcionSection />}

      <footer className="text-center text-zinc-700 text-[10px] uppercase tracking-widest pt-4 pb-2">© 2026 ONPE • Datos oficiales de resultadoelectoral.onpe.gob.pe • Auto-actualización: 30s</footer>
    </main>
  );
}

/* ===== SUB-COMPONENTS ===== */

function SenateSection({ data, title }: { data?: { parties?: any[]; percent?: number; totalActas?: number }; title: string }) {
  if (!data?.parties?.length) return <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8 text-center text-zinc-500">{title}<br />Esperando datos...</div>;
  const barData = data.parties.map((p: any, i: number) => ({ name: p.name.split(" ").slice(-2).join(" "), fullName: p.name, votes: p.votes, percent: p.validPercent || 0, color: p.color }));
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-zinc-500 text-sm">Actas: {data.percent}% ({data.totalActas?.toLocaleString()} total)</p>
      </div>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 30)}>
          <BarChart data={barData} layout="vertical" margin={{ left: 50 }}>
            <XAxis type="number" hide /><YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 10 }} width={50} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} formatter={(v: unknown, _n: unknown, p: any) => [`${fmt(v as number)} votos (${p.payload.percent}%)`, p.payload.fullName]} />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]}>{barData.map((e: any, i: number) => <Cell key={i} fill={e.color} fillOpacity={i < 5 ? 1 : 0.5} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800">
            <th className="text-left p-3">#</th><th className="text-left p-3">Partido</th><th className="text-right p-3">Votos</th><th className="text-right p-3">% Válidos</th>
          </tr></thead>
          <tbody>{data.parties.map((p: any, i: number) => (
            <tr key={i} className="border-b border-zinc-800/50">
              <td className="p-3 font-bold text-zinc-400">{i + 1}</td>
              <td className="p-3"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-white font-semibold">{p.name}</span></div></td>
              <td className="p-3 text-right font-mono text-white font-bold">{fmt(p.votes)}</td>
              <td className="p-3 text-right font-bold" style={{ color: p.color }}>{p.validPercent || 0}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ParlamentoSection({ data }: { data?: { parties?: any[]; percent?: number; totals?: any } }) {
  if (!data?.parties?.length) return <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8 text-center text-zinc-500">Parlamento Andino<br />Esperando datos...</div>;
  const barData = data.parties.slice(0, 15).map((p: any, i: number) => ({ name: p.name.split(" ").slice(-2).join(" "), fullName: p.name, votes: p.votes, percent: p.validPercent || 0, color: p.color }));
  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white">Parlamento Andino</h2>
        <p className="text-zinc-500 text-sm">Actas procesadas: {data.percent}% | Válidos: {fmt(data.totals?.validVotes || 0)} | Blancos: {fmt(data.totals?.blankVotes || 0)} | Nulos: {fmt(data.totals?.nullVotes || 0)}</p>
      </div>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={barData} layout="vertical" margin={{ left: 50 }}>
            <XAxis type="number" hide /><YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 10 }} width={50} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} formatter={(v: unknown, _n: unknown, p: any) => [`${fmt(v as number)} votos (${p.payload.percent}%)`, p.payload.fullName]} />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]}>{barData.map((e: any, i: number) => <Cell key={i} fill={e.color} fillOpacity={i === 0 ? 1 : 0.6} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800">
            <th className="text-left p-3">#</th><th className="text-left p-3">Partido</th><th className="text-right p-3">Votos</th><th className="text-right p-3">% Válidos</th>
          </tr></thead>
          <tbody>{data.parties.map((p: any, i: number) => (
            <tr key={i} className="border-b border-zinc-800/50">
              <td className="p-3 font-bold text-zinc-400">{i + 1}</td>
              <td className="p-3"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-white font-semibold">{p.name}</span></div></td>
              <td className="p-3 text-right font-mono text-white font-bold">{fmt(p.votes)}</td>
              <td className="p-3 text-right font-bold" style={{ color: p.color }}>{p.validPercent || 0}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ParticipacionSection({ data }: { data: any }) {
  const total = data.electoresHabiles || 27325432;
  const hasData = data.totalAsistentes > 0 || data.asistentesPercent > 0;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-emerald-500" /> Participación Ciudadana</h2>
        {data.actasPct > 0 && <p className="text-zinc-500 text-sm mt-1">Basado en {data.actasPct}% de actas contabilizadas ({data.totalActas?.toLocaleString()} total)</p>}
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Electores Hábiles", value: fmt(data.electoresHabiles), icon: Users, color: "text-blue-400" },
          { label: "Asistentes", value: fmt(data.totalAsistentes), icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Ausentes", value: fmt(data.totalAusentes), icon: AlertCircle, color: "text-red-400" },
          { label: "Pendientes", value: fmt(total - (data.totalAsistentes || 0) - (data.totalAusentes || 0)), icon: Clock, color: "text-zinc-400" },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 flex items-center gap-3">
            <s.icon className={s.color + " w-8 h-8"} /><div><p className="text-[10px] text-zinc-500 uppercase">{s.label}</p><p className="text-xl font-black text-white">{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Percentages */}
      {hasData && (
        <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6 space-y-4">
          <h3 className="font-bold text-white">Porcentaje de Participación</h3>
          {[
            { label: "Asistentes", pct: data.asistentesPercent, color: "bg-emerald-500", count: data.totalAsistentes },
            { label: "Ausentes", pct: data.ausentesPercent, color: "bg-red-500", count: data.totalAusentes },
            { label: "Pendientes", pct: data.pendientesPercent, color: "bg-zinc-600", count: total - (data.totalAsistentes || 0) - (data.totalAusentes || 0) },
          ].map(b => (
            <div key={b.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">{b.label}</span>
                <span className="text-white font-bold">{b.pct}% {b.count ? `(${fmt(b.count)})` : ''}</span>
              </div>
              <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.max(b.pct, 0.1)}%` }} />
              </div>
            </div>
          ))}
          <p className="text-zinc-600 text-[10px] italic">* Ciudadanos pendientes: Porcentaje aún no clasificado. Se actualizará conforme avance la contabilización.</p>
        </div>
      )}

      {/* Exterior vs Peru */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
          <p className="text-zinc-500 text-xs uppercase mb-1">Extranjero</p>
          <p className="text-3xl font-black text-white">{data.exteriorAsistentes || 0}%</p>
          <p className="text-zinc-600 text-xs">asistencia en el exterior</p>
        </div>
        <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
          <p className="text-zinc-500 text-xs uppercase mb-1">Perú</p>
          <p className="text-3xl font-black text-white">{data.peruAsistentes || 0}%</p>
          <p className="text-zinc-600 text-xs">asistencia en Perú</p>
        </div>
      </div>

      {!hasData && (
        <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
          <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Datos de participación se actualizarán cuando la ONPE procese más actas</p>
        </div>
      )}
    </div>
  );
}

function ActasSection({ data }: { data: Record<string, { total: number; percent: number; processed: number; jeePercent?: number; jeeCount?: number; pending: number; pendingPercent: number }> }) {
  const labels: Record<string, string> = {
    presidencial: "Presidencial",
    senadoresUnico: "Senadores D.E. Único",
    senadoresMultiple: "Senadores D.E. Múltiple",
    diputados: "Diputados",
    parlamentoAndino: "Parlamento Andino"
  };

  const totalActas = 92766;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-amber-500" /> Estado de Actas</h2>
        <p className="text-zinc-500 text-sm mt-1">Total de actas: {fmt(totalActas)} | Datos por tipo de elección</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
            <p className="text-[10px] text-zinc-500 uppercase mb-1">{labels[key] || key}</p>
            <p className="text-2xl font-black text-white">{val.percent}%</p>
            <p className="text-zinc-400 text-xs">{fmt(val.processed)} de {fmt(val.total)} actas</p>
          </div>
        ))}
      </div>

      {/* Detailed table */}
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Detalle por Tipo de Elección</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800">
                <th className="text-left p-3">Tipo</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Contabilizadas</th>
                <th className="text-right p-3">%</th>
                <th className="text-right p-3">Envío JEE</th>
                <th className="text-right p-3">Pendientes</th>
                <th className="text-left p-3 w-40">Progreso</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data).map(([key, val]) => (
                <tr key={key} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 text-white font-semibold">{labels[key] || key}</td>
                  <td className="p-3 text-right font-mono text-zinc-400">{fmt(val.total)}</td>
                  <td className="p-3 text-right font-mono text-emerald-400 font-bold">{fmt(val.processed)}</td>
                  <td className="p-3 text-right font-bold text-white">{val.percent}%</td>
                  <td className="p-3 text-right font-mono text-amber-400">{val.jeeCount ? fmt(val.jeeCount) : '—'}</td>
                  <td className="p-3 text-right font-mono text-zinc-500">{fmt(val.pending)}</td>
                  <td className="p-3">
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.max(val.percent, 0.1)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual comparison chart */}
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
        <h3 className="font-bold text-white mb-4">Comparación de Avance por Elección</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, val]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">{labels[key] || key}</span>
                <span className="text-white font-bold">{val.percent}%</span>
              </div>
              <div className="h-6 bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${val.percent}%` }} />
                {val.jeePercent && val.jeePercent > 0 && (
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${val.jeePercent}%` }} />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                <span>Contabilizadas: {fmt(val.processed)}</span>
                {val.jeeCount && val.jeeCount > 0 && <span className="text-amber-600">JEE: {fmt(val.jeeCount)}</span>}
                <span>Pendientes: {fmt(val.pending)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CorrupcionSection() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"resumen" | "patrimonial" | "fantasmas" | "judicial" | "familiares" | "factchecker" | "grafo">("resumen");
  const [corruptionData, setCorruptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/corruption-data")
      .then(r => r.json())
      .then(d => { setCorruptionData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const subTabs = [
    { id: "resumen", icon: Shield, label: "Resumen" },
    { id: "patrimonial", icon: TrendingUp, label: "Radar Patrimonial" },
    { id: "fantasmas", icon: AlertCircle, label: "Fantasmas" },
    { id: "judicial", icon: AlertTriangle, label: "Historial Judicial" },
    { id: "familiares", icon: Users, label: "Redes Familiares" },
    { id: "factchecker", icon: FileText, label: "Fact-Checker" },
    { id: "grafo", icon: Activity, label: "Grafo de Poder" },
  ];

  const indicators = [
    { id: "material", title: "Material Electoral No Entregado a Tiempo", severity: 78, status: "CONFIRMADO", category: "IRREGULARIDAD LOGÍSTICA", evidence: "La Defensoría del Pueblo reportó que 63,300 personas en distritos de Lima (Villa El Salvador, SJL, Comas) no pudieron votar porque el material electoral (cédulas, actas) no llegó a sus locales de votación. La ONPE admitió fallos en la logística de distribución.", source: "Defensoría del Pueblo, reporte oficial 12 abril 2026", impact: "63,300 ciudadanos privados de su derecho al voto" },
    { id: "noflash", title: "Eliminación del Flash Electoral Tradicional", severity: 65, status: "CONFIRMADO", category: "OPACIDAD INFORMATIVA", evidence: "La ONPE eliminó el tradicional 'flash electoral' que permitía a medios y ciudadanos ver resultados rápidos e independientes. Piero Corvetto confirmó que solo se publicarán resultados en la web oficial, sin data abierta ni comparativa rápida. Esto reduce drásticamente la capacidad de verificación ciudadana.", source: "Declaración ONPE, Piero Corvetto, marzo 2026", impact: "Reducción drástica de transparencia y escrutinio público" },
    { id: "votos", title: "Denuncias de Compra de Votos y Corrupción Electoral", severity: 85, status: "EN INVESTIGACIÓN", category: "ALERTA DE CORRUPCIÓN", evidence: "El JNE emitió Resolución Nº 0393-2026-JNE sobre 'Compra de votos o corrupción electoral, fraude, suplantación o voto ilegal'. Múltiples denuncias ciudadanas reportadas en redes sociales y medios. Se establecieron mecanismos para que testigos electorales reporten irregularidades en mesa.", source: "JNE Resolución 0393-2026-JNE", impact: "Integridad del proceso electoral bajo investigación formal" },
    { id: "exterior", title: "Voto Suspendido en Medio Oriente", severity: 72, status: "CONFIRMADO", category: "IRREGULARIDAD CONSTITUCIONAL", evidence: "El canciller Hugo de Zela anunció que las elecciones no se realizarán en Medio Oriente por 'falta de condiciones de seguridad'. Miles de peruanos residentes en la región fueron privados de su derecho constitucional al voto sin alternativa de voto postal o digital.", source: "TVPerú Noticias, canciller Hugo de Zela, marzo 2026", impact: "Miles de ciudadanos sin derecho al voto en el exterior" },
    { id: "cedulas", title: "Costo Millonario en Traslado de Cédulas del Extranjero", severity: 55, status: "CONFIRMADO", category: "IRREGULARIDAD FINANCIERA", evidence: "Las cédulas de sufragio del extranjero deben volver a Lima para ser custodiadas por la ONPE, costando más de S/1 millón (USD ~270,000). Antes de 2026 se custodiaban localmente en consulados. Ojo Público investigó el costo adicional sin justificación pública clara y la cadena de custodia cuestionable.", source: "Ojo Público investigación #6159, marzo 2026", impact: "S/1M+ en costos adicionales, cadena de custodia cuestionable" },
    { id: "locales", title: "ONPE Tuvo que 'Mendigar' Locales de Votación", severity: 60, status: "CONFIRMADO", category: "IRREGULARIDAD LOGÍSTICA", evidence: "Piero Corvetto (jefe de la ONPE) reveló ante el Congreso que instituciones públicas y privadas se negaron a ceder espacios para votación, obligando a la ONPE a 'mendigar' locales. Esto compromete la calidad de la infraestructura electoral y facilita irregularidades.", source: "El Comercio, declaración ante el Congreso, marzo 2026", impact: "Infraestructura electoral comprometida" },
    { id: "observers", title: "Observación Electoral Internacional Activa", severity: -15, status: "POSITIVO", category: "MEDIDA DE TRANSPARENCIA", evidence: "OEA y Unión Europea tienen misiones de observación electoral activas en Perú con más de 200 observadores desplegados. Esto es una medida positiva que reduce significativamente el riesgo de fraude no detectado.", source: "ANDINA, acuerdos ratificados marzo 2026", impact: "Mayor supervisión internacional del proceso" },
    { id: "fragmentacion", title: "Fragmentación Electoral sin Precedentes", severity: 45, status: "DATO VERIFICADO", category: "IRREGULARIDAD SISTÉMICA", evidence: "36 candidatos presidenciales (récord histórico). 47% de votos dispersos entre candidatos menores. Solo 28% de votantes se considera bien informado sobre candidatos. 44% vota por pragmatismo vs 20% por programa. 68% cita crimen como preocupación #1.", source: "Ipsos, CPI, Datum - encuestas marzo-abril 2026", impact: "Resultados posiblemente no representativos de la voluntad popular" },
    { id: "actas", title: "Retraso en Envío de Actas al JEE", severity: 52, status: "EN CURSO", category: "IRREGULARIDAD PROCESAL", evidence: "Solo 28 actas han sido enviadas al JEE para validación de 92,766 totales. El cuello de botella en el envío de actas puede retrasar los resultados oficiales y generar desconfianza.", source: "ONPE, datos al 13/04/2026 07:57 AM", impact: "Posible retraso en proclamación de resultados oficiales" },
    { id: "transparencia", title: "Falta de Datos Abiertos en Tiempo Real", severity: 58, status: "CONFIRMADO", category: "OPACIDAD INFORMATIVA", evidence: "La ONPE no proporciona API pública ni datos abiertos en formato JSON para verificación independiente. Los datos solo están disponibles en su web propietaria sin posibilidad de auditoría externa automatizada.", source: "Análisis técnico del portal ONPE", impact: "Imposibilidad de verificación independiente automatizada" },
    { id: "pragmatismo", title: "Voto Pragmático vs Informado", severity: 40, status: "DATO DE ENCUESTA", category: "ANÁLISIS SOCIOLÓGICO", evidence: "44% de votantes elige por pragmatismo ('quién hará más por la mayoría') vs solo 20% por afinidad programática/ideológica. Esto sugiere que muchos votos no están basados en conocimiento real de propuestas de gobierno sino en percepciones superficiales.", source: "CPI, encuesta marzo 2026", impact: "Decisiones de voto posiblemente no informadas" },
    { id: "inseguridad", title: "Crimen como Preocupación Principal", severity: 35, status: "DATO DE ENCUESTA", category: "CONTEXTO ELECTORAL", evidence: "68% de votantes cita crimen/violencia como su preocupación #1, por encima de economía (52%) y corrupción (48%). Esto puede estar distorsionando el voto hacia candidatos con propuestas de mano dura.", source: "Ipsos, encuesta abril 2026", impact: "Posible polarización hacia propuestas autoritarias" }
  ];

  const score = 62;

  if (loading) {
    return (
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8 text-center">
        <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
        <p className="text-zinc-400">Cargando datos de corrupción...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${subTab === t.id ? "bg-red-600 text-white shadow-lg" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Module 1: Radar Patrimonial */}
      {subTab === "patrimonial" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-amber-500" /> Módulo 1: Radar Patrimonial</h2>
            <p className="text-zinc-400 text-sm mt-2">Datos REALES de {corruptionData?.candidatos?.length || 0} candidatos extraídos de la API del JNE Voto Informado.</p>
          </div>
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Todos los Candidatos - Datos Reales del JNE</h3></div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800 sticky top-0 bg-zinc-900">
                  <th className="text-left p-3 w-12">#</th><th className="text-left p-3">Nombre Completo</th><th className="text-left p-3">Partido Político</th><th className="text-right p-3">DNI</th><th className="text-left p-3">Cargo</th><th className="text-left p-3">Estado</th>
                </tr></thead>
                <tbody>{(corruptionData?.candidatos || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="p-3 text-zinc-500 font-bold">{c.id}</td>
                    <td className="p-3 text-white font-semibold">{c.nombre}</td>
                    <td className="p-3 text-zinc-400">{c.partido}</td>
                    <td className="p-3 text-right font-mono text-zinc-500">{c.nroDocumento || '—'}</td>
                    <td className="p-3 text-zinc-400 text-xs">{c.cargo || '—'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">{c.estado || 'INSCRITO'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Buscador de Fantasmas */}
      {subTab === "fantasmas" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> Módulo 2: Buscador de "Fantasmas"</h2>
            <p className="text-zinc-400 text-sm mt-2">Cruce de aportantes de campaña con proveedores del Estado para detectar conflictos de interés.</p>
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm font-semibold">⚠ Datos no disponibles en tiempo real</p>
              <p className="text-zinc-400 text-xs mt-1">{corruptionData?.moduleStatus?.buscadorFantasmas?.description}</p>
              <div className="mt-3 space-y-2">
                <p className="text-zinc-500 text-xs">Fuentes necesarias:</p>
                <ul className="text-zinc-400 text-xs space-y-1 ml-4 list-disc">
                  <li>ONPE Claridad - Aportantes de campaña (interfaz HTML)</li>
                  <li>SEACE - Contratos del Estado (interfaz HTML)</li>
                  <li>SUNAT - Estado de empresas (bloqueado por CAPTCHA)</li>
                </ul>
              </div>
              <a href={corruptionData?.moduleStatus?.buscadorFantasmas?.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs mt-3 inline-block hover:underline">→ Ir a ONPE Claridad</a>
            </div>
          </div>
        </div>
      )}

      {/* Module 3: Historial Judicial */}
      {subTab === "judicial" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Módulo 3: Historial Judicial</h2>
            <p className="text-zinc-400 text-sm mt-2">Antecedentes penales, sentencias firmes y alertas de corrupción de {corruptionData?.candidatos?.length || 0} candidatos. Datos REALES.</p>
          </div>
          {/* All candidates table */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Todos los Candidatos - Datos del JNE</h3></div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800 sticky top-0 bg-zinc-900">
                  <th className="text-left p-3 w-12">#</th><th className="text-left p-3">Nombre</th><th className="text-left p-3">Partido</th><th className="text-right p-3">DNI</th><th className="text-left p-3">Estado</th>
                </tr></thead>
                <tbody>{(corruptionData?.candidatos || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="p-3 text-zinc-500 font-bold">{c.id}</td>
                    <td className="p-3 text-white font-semibold">{c.nombre}</td>
                    <td className="p-3 text-zinc-400">{c.partido}</td>
                    <td className="p-3 text-right font-mono text-zinc-500">{c.nroDocumento || '—'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">{c.estado || 'INSCRITO'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          {/* Red flags from indicators */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Alertas de Corrupción Detectadas</h3></div>
            {(corruptionData?.indicadores || indicators).filter((i: any) => i.category === "ALERTA DE CORRUPCIÓN" || i.severity >= 70).map((ind: any) => (
              <div key={ind.id} className="p-4 border-b border-zinc-800/50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{ind.title}</p>
                    <p className="text-zinc-400 text-xs mt-1">{ind.evidence}</p>
                    <p className="text-zinc-500 text-[10px] mt-2 italic">Fuente: {ind.source}</p>
                    <p className="text-zinc-400 text-xs mt-1"><strong className="text-zinc-300">Impacto:</strong> {ind.impact}</p>
                  </div>
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">{ind.severity}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module 4: Redes Familiares */}
      {subTab === "familiares" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-purple-500" /> Módulo 4: Redes Familiares</h2>
            <p className="text-zinc-400 text-sm mt-2">Detecta nepotismo anticipado: familiares del candidato trabajando en el Estado.</p>
            <div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <p className="text-purple-300 text-sm font-semibold">⚠ Cruce de datos no disponible automáticamente</p>
              <p className="text-zinc-400 text-xs mt-1">{corruptionData?.moduleStatus?.redesFamiliares?.description}</p>
              <div className="mt-3 space-y-2">
                <p className="text-zinc-500 text-xs">Fuentes necesarias:</p>
                <ul className="text-zinc-400 text-xs space-y-1 ml-4 list-disc">
                  <li>JNE Voto Informado - Nombres de familiares en Hoja de Vida</li>
                  <li>Portal de Transparencia MEF - Planillas del Estado</li>
                </ul>
              </div>
              <a href={corruptionData?.moduleStatus?.redesFamiliares?.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs mt-3 inline-block hover:underline">→ Ir a Portal de Transparencia</a>
            </div>
          </div>
        </div>
      )}

      {/* Module 5: Fact-Checker */}
      {subTab === "factchecker" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Módulo 5: Fact-Checker de Propuestas</h2>
            <p className="text-zinc-400 text-sm mt-2">Planes de gobierno de {corruptionData?.candidatos?.length || 0} candidatos. Datos REALES del JNE.</p>
          </div>
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Planes de Gobierno - Datos del JNE</h3></div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800 sticky top-0 bg-zinc-900">
                  <th className="text-left p-3 w-12">#</th><th className="text-left p-3">Candidato</th><th className="text-left p-3">Partido</th><th className="text-left p-3">Plan de Gobierno</th>
                </tr></thead>
                <tbody>{(corruptionData?.candidatos || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="p-3 text-zinc-500 font-bold">{c.id}</td>
                    <td className="p-3 text-white font-semibold">{c.nombre}</td>
                    <td className="p-3 text-zinc-400">{c.partido}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">PDF disponible en JNE</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Module 6: Grafo de Poder */}
      {subTab === "grafo" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-500" /> Grafo de Poder</h2>
            <p className="text-zinc-400 text-sm mt-2">Visualización de conexiones entre candidatos, empresas y contratos estatales.</p>
            <div className="mt-4 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-300 text-sm font-semibold">⚠ Esperando cruce de datos del OSCE/ONPE</p>
              <p className="text-zinc-400 text-xs mt-1">{corruptionData?.moduleStatus?.grafoPoder?.description}</p>
              <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                <p className="text-zinc-300 text-xs font-semibold mb-2">Nodos del grafo:</p>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Candidato</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Empresa Aportante</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Contrato Estatal</span>
                </div>
              </div>
            </div>
          </div>
          {/* Placeholder visualization */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8 text-center">
            <Activity className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">El grafo de poder requiere datos cruzados de SEACE y ONPE Claridad</p>
            <p className="text-zinc-600 text-xs mt-2">Ambas fuentes son interfaces HTML sin API disponible para automatización</p>
          </div>
        </div>
      )}

      {/* Resumen (default view with indicators) */}
      {subTab === "resumen" && (
        <>
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Buscador de la Verdad</h2>
            <div className="mt-4 flex items-center gap-6">
              <div className="relative w-24 h-24"><svg className="w-full h-full -rotate-90"><circle cx="48" cy="48" r="40" stroke="#27272a" strokeWidth="8" fill="transparent" /><circle cx="48" cy="48" r="40" stroke="#f59e0b" strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - score / 100)} strokeLinecap="round" /></svg><div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-white">{score}</span></div></div>
              <div><p className="text-amber-400 font-bold text-lg">MODERADO-ALTO</p><p className="text-zinc-500 text-sm">Índice de Corrupción Electoral</p></div>
            </div>
          </div>
          {indicators.map(ind => (
            <div key={ind.id} className="bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden">
              <button onClick={() => setExpanded(expanded === ind.id ? null : ind.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  {ind.severity > 0 ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <div><p className="font-semibold text-white text-sm">{ind.title}</p><p className="text-[10px] text-zinc-500">{ind.category} • {ind.status}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ind.severity > 70 ? "bg-red-500/20 text-red-400 border-red-500/30" : ind.severity > 0 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}>{ind.severity > 0 ? `${ind.severity}/100` : `+${Math.abs(ind.severity)}`}</span>
                  <span className="text-zinc-500 text-xs">{expanded === ind.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {expanded === ind.id && (
                <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-900/60">
                  <p className="text-zinc-300 text-sm leading-relaxed">{ind.evidence}</p>
                  <div className="flex items-start gap-2"><AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /><p className="text-zinc-400 text-xs"><strong className="text-zinc-300">Impacto:</strong> {ind.impact}</p></div>
                  <p className="text-zinc-500 text-xs italic">Fuente: {ind.source}</p>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
