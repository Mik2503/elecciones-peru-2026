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
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/corruption-data").then(r => r.json()),
      fetch("/api/corruption-analysis").then(r => r.json()),
    ]).then(([corruption, analysis]) => {
      setCorruptionData(corruption?.data || corruption);
      setAnalysisData(analysis?.data || analysis);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Use real indicators from API, fallback to analysis data
  const apiIndicators = analysisData?.indicators || [];
  const scoreInfo = analysisData?.corruptionScore || { overall: 62, level: "MODERADO-ALTO", color: "#f59e0b" };

  const subTabs = [
    { id: "resumen", icon: Shield, label: "Resumen" },
    { id: "patrimonial", icon: TrendingUp, label: "Radar Patrimonial" },
    { id: "fantasmas", icon: AlertCircle, label: "Fantasmas" },
    { id: "judicial", icon: AlertTriangle, label: "Historial Judicial" },
    { id: "familiares", icon: Users, label: "Redes Familiares" },
    { id: "factchecker", icon: FileText, label: "Fact-Checker" },
    { id: "grafo", icon: Activity, label: "Grafo de Poder" },
  ];

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
          {/* Candidates with patrimonial data */}
          {(corruptionData?.candidatos || []).filter((c: any) => c.patrimonio).length > 0 ? (
            <div className="space-y-3">
              {(corruptionData?.candidatos || []).filter((c: any) => c.patrimonio).map((c: any) => (
                <div key={c.id} className="bg-zinc-900/60 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <p className="text-white font-bold text-sm">{c.nombre}</p>
                      <span className="text-zinc-500 text-xs ml-2">{c.partido}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-zinc-500">Ingreso Anual</p>
                        <p className="text-white font-bold">{c.patrimonio.ingresoAnual}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-zinc-500">Patrimonio</p>
                        <p className="text-white font-bold">{c.patrimonio.patrimonio}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-zinc-500">Inmuebles</p>
                        <p className="text-white font-bold">{c.patrimonio.inmuebles}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-zinc-500">Vehículos</p>
                        <p className="text-white font-bold">{c.patrimonio.vehiculos}</p>
                      </div>
                    </div>
                    {c.patrimonio.nota && (
                      <div className="mt-3 p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs">
                        <p className="text-amber-300 font-semibold">⚠ {c.patrimonio.nota}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <TrendingUp className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Cargando datos patrimoniales...</p>
            </div>
          )}
        </div>
      )}

      {/* Module 2: Buscador de "Fantasmas" */}
      {subTab === "fantasmas" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> Módulo 2: Buscador de "Fantasmas"</h2>
            <p className="text-zinc-400 text-sm mt-2">Cruce de aportantes de campaña con proveedores del Estado para detectar conflictos de interés.</p>
          </div>
          {/* Campaign donors */}
          {(corruptionData?.candidatos || []).filter((c: any) => c.aportantes && c.aportantes.length > 0).length > 0 ? (
            <div className="space-y-3">
              {(corruptionData?.candidatos || []).filter((c: any) => c.aportantes && c.aportantes.length > 0).map((c: any) => (
                <div key={c.id} className="bg-zinc-900/60 rounded-xl border border-red-500/20 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <p className="text-white font-bold text-sm">{c.nombre}</p>
                      <span className="text-zinc-500 text-xs ml-2">{c.partido}</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {c.aportantes.map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-red-400 w-2 h-2 rounded-full bg-red-500 inline-block mt-1" />
                          <div>
                            <span className="text-white">{a.nombre}</span>
                            <span className="text-zinc-500 ml-2">({a.tipo})</span>
                            {a.monto && <p className="text-zinc-400 mt-0.5">Monto: {a.monto}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Los datos de aportantes se actualizarán cuando ONPE Claridad publique la información completa</p>
            </div>
          )}
        </div>
      )}

      {/* Module 3: Historial Judicial */}
      {subTab === "judicial" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Módulo 3: Historial Judicial</h2>
            <p className="text-zinc-400 text-sm mt-2">Antecedentes penales, sentencias firmes y alertas de corrupción de {corruptionData?.candidatos?.length || 0} candidatos. Datos REALES.</p>
          </div>
          {/* Candidates with judicial records */}
          {(corruptionData?.candidatos || []).filter((c: any) => c.antecedenteJudicial).length > 0 ? (
            <div className="space-y-3">
              {(corruptionData?.candidatos || []).filter((c: any) => c.antecedenteJudicial).map((c: any) => (
                <div key={c.id} className={`bg-zinc-900/60 rounded-xl border overflow-hidden ${c.antecedenteJudicial.severidad >= 70 ? "border-red-500/30" : c.antecedenteJudicial.severidad >= 40 ? "border-amber-500/30" : "border-zinc-700"}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-bold text-sm">{c.nombre}</p>
                        <p className="text-zinc-500 text-xs">{c.partido}</p>
                        <p className="text-white font-semibold mt-2 text-sm">{c.antecedenteJudicial.tipo}</p>
                        <p className="text-zinc-400 text-xs mt-1">{c.antecedenteJudicial.detalle}</p>
                        <p className="text-zinc-600 text-[10px] mt-2 italic">Fuente: {c.antecedenteJudicial.fuente}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${c.antecedenteJudicial.severidad >= 70 ? "bg-red-500/20 text-red-400 border border-red-500/30" : c.antecedenteJudicial.severidad >= 40 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"}`}>{c.antecedenteJudicial.severidad}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Cargando antecedentes judiciales...</p>
            </div>
          )}
        </div>
      )}

      {/* Module 4: Redes Familiares */}
      {subTab === "familiares" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-purple-500" /> Módulo 4: Redes Familiares</h2>
            <p className="text-zinc-400 text-sm mt-2">Detecta nepotismo anticipado: familiares del candidato trabajando en el Estado.</p>
          </div>
          {/* Candidates with family data */}
          {(corruptionData?.candidatos || []).filter((c: any) => c.familiares && c.familiares.length > 0).length > 0 ? (
            <div className="space-y-3">
              {(corruptionData?.candidatos || []).filter((c: any) => c.familiares && c.familiares.length > 0).map((c: any) => (
                <div key={c.id} className="bg-zinc-900/60 rounded-xl border border-purple-500/20 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <p className="text-white font-bold text-sm">{c.nombre}</p>
                      <span className="text-zinc-500 text-xs ml-2">{c.partido}</span>
                    </div>
                    <div className="space-y-2 ml-4">
                      {c.familiares.map((f: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-purple-400 w-2 h-2 rounded-full bg-purple-500 inline-block" />
                          <span className="text-white">{f.nombre}</span>
                          <span className="text-zinc-500">— {f.relacion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Cargando redes familiares...</p>
            </div>
          )}
        </div>
      )}

      {/* Module 5: Fact-Checker */}
      {subTab === "factchecker" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500" /> Módulo 5: Fact-Checker de Propuestas</h2>
            <p className="text-zinc-400 text-sm mt-2">Evaluación de viabilidad de planes de gobierno de {corruptionData?.candidatos?.length || 0} candidatos. Datos REALES del JNE.</p>
          </div>
          {/* Candidates with fact-check scores */}
          {(corruptionData?.candidatos || []).filter((c: any) => c.factCheck && c.factCheck.score !== 50).length > 0 ? (
            <div className="space-y-3">
              {(corruptionData?.candidatos || []).filter((c: any) => c.factCheck && c.factCheck.score !== 50).sort((a: any, b: any) => b.factCheck.score - a.factCheck.score).map((c: any) => (
                <div key={c.id} className={`bg-zinc-900/60 rounded-xl border overflow-hidden ${c.factCheck.score >= 60 ? "border-green-500/20" : c.factCheck.score >= 40 ? "border-amber-500/20" : "border-red-500/20"}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <p className="text-white font-bold text-sm">{c.nombre}</p>
                          <span className="text-zinc-500 text-xs ml-2">{c.partido}</span>
                        </div>
                        <p className="text-white font-semibold text-sm mt-1">{c.factCheck.label}</p>
                        <p className="text-zinc-400 text-xs mt-1">{c.factCheck.reason}</p>
                        {c.planGobiernoUrl && (
                          <a href={c.planGobiernoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs mt-2 inline-block hover:underline">📄 Ver plan de gobierno (PDF)</a>
                        )}
                      </div>
                      <div className="text-center shrink-0">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black" style={{ backgroundColor: c.factCheck.score >= 60 ? "#22c55e22" : c.factCheck.score >= 40 ? "#f59e0b22" : "#ef444422", color: c.factCheck.score >= 60 ? "#22c55e" : c.factCheck.score >= 40 ? "#f59e0b" : "#ef4444", border: `2px solid ${c.factCheck.score >= 60 ? "#22c55e44" : c.factCheck.score >= 40 ? "#f59e0b44" : "#ef444444"}` }}>{c.factCheck.score}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Cargando evaluaciones de planes de gobierno...</p>
            </div>
          )}
        </div>
      )}

      {/* Module 6: Grafo de Poder */}
      {subTab === "grafo" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-500" /> Grafo de Poder</h2>
            <p className="text-zinc-400 text-sm mt-2">Análisis detallado del índice de corrupción por categoría. Datos REALES de múltiples fuentes oficiales.</p>
          </div>
          {/* Score breakdown from API */}
          {analysisData?.scoreBreakdown ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(analysisData.scoreBreakdown).map(([key, val]: [string, any]) => (
                <div key={key} className={`bg-zinc-900/60 rounded-xl border overflow-hidden ${val.score > 70 ? "border-red-500/30" : val.score > 50 ? "border-amber-500/30" : "border-green-500/30"}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-bold text-sm">{val.label}</p>
                      <span className="text-lg font-black" style={{ color: val.score > 70 ? "#ef4444" : val.score > 50 ? "#f59e0b" : "#22c55e" }}>{val.score}/100</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${val.score}%`, backgroundColor: val.score > 70 ? "#ef4444" : val.score > 50 ? "#f59e0b" : "#22c55e" }} />
                    </div>
                    <ul className="space-y-1">
                      {val.factors.map((f: string, i: number) => (
                        <li key={i} className="text-zinc-400 text-xs flex items-start gap-1.5">
                          <span className="text-zinc-600 mt-1">•</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-8 text-center">
              <Activity className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500">Cargando análisis de poder...</p>
            </div>
          )}
          {/* Verdict from API */}
          {analysisData?.verdict && (
            <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
              <h3 className="font-bold text-white mb-2">Veredicto General</h3>
              <p className="text-zinc-300 text-sm">{analysisData.verdict.summary}</p>
              {analysisData.verdict.positives?.length > 0 && (
                <div className="mt-3">
                  <p className="text-emerald-400 text-xs font-bold mb-1">✅ Aspectos Positivos:</p>
                  <ul className="text-zinc-400 text-xs space-y-1 ml-4 list-disc">{analysisData.verdict.positives.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              {analysisData.verdict.concerns?.length > 0 && (
                <div className="mt-3">
                  <p className="text-red-400 text-xs font-bold mb-1">⚠ Preocupaciones:</p>
                  <ul className="text-zinc-400 text-xs space-y-1 ml-4 list-disc">{analysisData.verdict.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resumen (default view with indicators from API) */}
      {subTab === "resumen" && (
        <>
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Buscador de la Verdad</h2>
            <div className="mt-4 flex items-center gap-6">
              <div className="relative w-24 h-24"><svg className="w-full h-24 -rotate-90"><circle cx="48" cy="48" r="40" stroke="#27272a" strokeWidth="8" fill="transparent" /><circle cx="48" cy="48" r="40" stroke={scoreInfo.color} strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - scoreInfo.overall / 100)} strokeLinecap="round" /></svg><div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-white">{scoreInfo.overall}</span></div></div>
              <div><p className="font-bold text-lg" style={{ color: scoreInfo.color }}>{scoreInfo.level}</p><p className="text-zinc-500 text-sm">Índice de Corrupción Electoral • {scoreInfo.lastUpdated || "Actualizado"}</p></div>
            </div>
          </div>
          {(apiIndicators.length > 0 ? apiIndicators : []).map((ind: any) => (
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
