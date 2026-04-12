"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Area, AreaChart
} from "recharts";
import {
  TrendingUp, Users, FileText, AlertCircle, RefreshCcw, CheckCircle2,
  MapPin, Shield, Search, AlertTriangle, Eye, Zap, Globe, Scale,
  Clock, Target, BarChart3, Activity, Flag
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Candidate {
  id: number; name: string; party: string; votes: number;
  color: string; percent?: number;
}
interface ElectionData {
  timestamp: number; status: string; percentCounted: number;
  candidates: Candidate[]; isExitPoll?: boolean;
  totals: { valid: number; blank: number; null: number; total: number };
  message?: string;
}
interface ComprehensiveData {
  bocaDeUrna: { candidates: Candidate[]; source: string; time: string };
  encuestas: {
    ipsos: { validVotePercentages: { name: string; percent: number; party: string }[]; undecided: number };
    cpi: { validVotePercentages: { name: string; percent: number; party: string }[]; undecided: number };
  };
  regional: Record<string, { label: string; topCandidates: { name: string; party: string; percent: number }[] }>;
  metrics: Record<string, string>;
  totals: { registeredVoters: number; estimatedTurnout: number; turnoutPercent: number; validVotes: number; blankVotes: number; nullVotes: number; totalVotes: number };
}
interface CorruptionData {
  corruptionScore: { overall: number; level: string; color: string };
  indicators: {
    id: string; category: string; title: string; severity: number;
    status: string; evidence: string; source: string; impact: string; verified: boolean;
  }[];
  scoreBreakdown: Record<string, { label: string; score: number; factors: string[] }>;
  timeline: { date: string; event: string; severity: number }[];
  verdict: { summary: string; positives: string[]; concerns: string[]; recommendation: string };
}

const fmt = (n: number) => n.toLocaleString("es-PE");
const fmtM = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "K";

/** Corruption Score Gauge */
const CorruptionGauge = ({ score, level, color }: { score: number; level: string; color: string }) => {
  const r = 80, c = 2 * Math.PI * r, off = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="88" cy="88" r={r} stroke="#27272a" strokeWidth="14" fill="transparent" />
          <circle cx="88" cy="88" r={r} stroke={color} strokeWidth="14" fill="transparent"
            strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
            className="drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-white">{score}</span>
          <span className="text-[10px] text-zinc-400 uppercase">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-bold mt-2" style={{ color }}>{level}</span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Índice de Corrupción</span>
    </div>
  );
};

/** Severity Badge */
const SeverityBadge = ({ sev }: { sev: number }) => {
  const color = sev > 70 ? "bg-red-500/20 text-red-400 border-red-500/30" :
    sev > 50 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
      sev > 0 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
        "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  return <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", color)}>
    {sev > 0 ? `SEVERIDAD: ${sev}/100` : `POSITIVO: ${sev}`}
  </span>;
};

export default function ElectoralDashboard() {
  const [data, setData] = useState<{ current: ElectionData | null; history: ElectionData[]; comprehensive?: ComprehensiveData; corruption?: CorruptionData }>({
    current: null, history: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resultados" | "regional" | "corrupcion" | "encuestas">("resultados");
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      const json = await res.json();
      if (json.current) { setData(json); setError(null); setLastRefresh(new Date().toLocaleTimeString("es-PE")); }
      else setError(json.message || "Sin datos");
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, []);

  const corruption = data.corruption;
  const comprehensive = data.comprehensive;
  const current = data.current;

  if (loading && !current) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <RefreshCcw className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-white ml-4 font-medium">Sincronizando...</p>
      </div>
    );
  }
  if (error && !current) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Esperando Datos</h2>
          <p className="text-zinc-400">{error}</p>
          <button onClick={() => { setLoading(true); setError(null); fetchData(); }}
            className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!current) return null;

  const barData = (current.candidates || []).map(c => ({ name: c.name.split(" ").pop(), fullName: c.name, party: c.party, votos: c.votes, color: c.color, percent: c.percent || 0 }));
  const radarData = corruption ? Object.entries(corruption.scoreBreakdown).map(([k, v]) => ({ name: v.label.split(" ")[0], score: v.score, fullMark: 100 })) : [];

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-3 md:p-6 space-y-4">
      {/* HEADER */}
      <header className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-zinc-800 p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic">
              Electoral <span className="text-red-500">Perú</span> <span className="text-zinc-500">2026</span>
            </h1>
            <span className={cn("px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider",
              current.isExitPoll ? "bg-amber-600/30 text-amber-300 border border-amber-500/30" : "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
            )}>{current.isExitPoll ? "BOCA DE URNA" : "OFICIAL"}</span>
            <span className="px-3 py-1 bg-blue-600/30 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">12 ABRIL</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {lastRefresh}</span>
            <span className="text-zinc-500">Auto-refresh: 30s</span>
            <button onClick={fetchData} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-300">
              <RefreshCcw className="w-3 h-3" /> Actualizar
            </button>
          </div>
        </div>
        <p className="text-zinc-500 text-sm mt-2">{current.status || "Datos electorales"} • {current.message || ""}</p>
      </header>

      {/* TABS */}
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "resultados" as const, icon: BarChart3, label: "Resultados" },
          { id: "regional" as const, icon: MapPin, label: "Regional" },
          { id: "encuestas" as const, icon: Activity, label: "Encuestas" },
          { id: "corrupcion" as const, icon: Shield, label: "🔍 Corrupción" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
              activeTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </nav>

      {/* ============ RESULTADOS TAB ============ */}
      {activeTab === "resultados" && (
        <div className="space-y-4">
          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Votos Válidos", value: fmtM(current.totals?.valid || 0), icon: CheckCircle2, color: "text-blue-400" },
              { label: "Votos Nulos", value: fmtM(current.totals?.null || 0), icon: AlertCircle, color: "text-red-400" },
              { label: "Votos Blancos", value: fmtM(current.totals?.blank || 0), icon: FileText, color: "text-zinc-400" },
              { label: "Participación", value: comprehensive ? fmtM(comprehensive.totals.estimatedTurnout) + " (75%)" : "—", icon: Users, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 flex items-center gap-3">
                <s.icon className={cn("w-8 h-8", s.color)} />
                <div><p className="text-[10px] text-zinc-500 uppercase">{s.label}</p><p className="text-xl font-black text-white">{s.value}</p></div>
              </div>
            ))}
          </div>

          {/* Horizontal Bar Chart */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4 md:p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-red-500" /> Resultados Presidenciales</h2>
            <ResponsiveContainer width="100%" height={Math.max(400, barData.length * 36)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 50 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 11, fontWeight: 'bold' }} width={50} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  formatter={(v: unknown, _n: unknown, p: any) => [`${fmt(v as number)} votos (${p.payload.percent || 0}%)`, p.payload.fullName]} />
                <Bar dataKey="votos" radius={[0, 6, 6, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={i === 0 ? 1 : 0.65} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Candidates Table */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800"><h3 className="font-bold text-white">Detalle por Candidato</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800">
                  <th className="text-left p-3">#</th><th className="text-left p-3">Candidato</th>
                  <th className="text-right p-3">Votos</th><th className="text-right p-3">%</th><th className="text-left p-3 w-32">Barra</th>
                </tr></thead>
                <tbody>{barData.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 font-bold text-zinc-400">{i + 1}</td>
                    <td className="p-3"><div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <div><p className="font-semibold text-white">{c.fullName}</p><p className="text-[10px] text-zinc-500">{c.party}</p></div>
                    </div></td>
                    <td className="p-3 text-right font-mono text-white font-bold">{fmt(c.votos)}</td>
                    <td className="p-3 text-right font-bold" style={{ color: c.color }}>{c.percent || 0}%</td>
                    <td className="p-3"><div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(c.percent || 0, 1)}%`, backgroundColor: c.color }} />
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ REGIONAL TAB ============ */}
      {activeTab === "regional" && comprehensive && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(comprehensive.regional).map(([key, region]) => (
              <div key={key} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
                <h3 className="font-bold text-white mb-1">{region.label}</h3>
                <p className="text-[10px] text-zinc-500 mb-3">{region.label === "Lima Metropolitana" ? "~9.5M votantes" : "Provincias"}</p>
                <div className="space-y-2">
                  {region.topCandidates.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-xs w-4">{i + 1}</span>
                        <span className="text-sm text-zinc-300">{c.name}</span>
                        <span className="text-[10px] text-zinc-600">{c.party}</span>
                      </div>
                      <span className="font-bold text-white">{c.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Metrics */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-blue-400" /> Métricas Clave</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {comprehensive.metrics && Object.entries(comprehensive.metrics).map(([k, v]) => (
                <div key={k} className="flex gap-3"><span className="text-zinc-500 text-sm capitalize w-32 shrink-0">{k.replace(/([A-Z])/g, ' $1').trim()}:</span><span className="text-zinc-300 text-sm">{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ ENCUESTAS TAB ============ */}
      {activeTab === "encuestas" && comprehensive && (
        <div className="space-y-4">
          {[
            { title: "Ipsos (2-3 Abril)", data: comprehensive.encuestas?.ipsos?.validVotePercentages || [] },
            { title: "CPI (Marzo)", data: comprehensive.encuestas?.cpi?.validVotePercentages || [] },
          ].map(poll => (
            <div key={poll.title} className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
              <h3 className="font-bold text-white mb-4">{poll.title}</h3>
              <ResponsiveContainer width="100%" height={poll.data.length * 36}>
                <BarChart data={poll.data} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 11 }} width={50} />
                  <Bar dataKey="percent" radius={[0, 4, 4, 0]} fill="#3b82f6" fillOpacity={0.7}>
                    {poll.data.map((_: any, i: number) => <Cell key={i} fillOpacity={1 - i * 0.05} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* ============ CORRUPCIÓN TAB ============ */}
      {activeTab === "corrupcion" && corruption && (
        <div className="space-y-4">
          {/* Score Overview */}
          <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6"><Shield className="w-5 h-5 text-amber-500" /> Buscador de la Verdad — Puntaje de Corrupción</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <CorruptionGauge score={corruption.corruptionScore.overall} level={corruption.corruptionScore.level} color={corruption.corruptionScore.color} />
              <div className="md:col-span-2">
                <p className="text-zinc-300 text-sm leading-relaxed">{corruption.verdict.summary}</p>
              </div>
            </div>
          </div>

          {/* Radar */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-purple-400" /> Desglose por Dimensión</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Corrupción" dataKey="score" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Indicators */}
          <div className="space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2"><Search className="w-4 h-4 text-red-400" /> Indicadores de Corrupción</h3>
            {corruption.indicators.map(ind => (
              <div key={ind.id} className="bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden">
                <button onClick={() => setExpandedIndicator(expandedIndicator === ind.id ? null : ind.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {ind.severity > 0 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <div>
                      <p className="font-semibold text-white text-sm">{ind.title}</p>
                      <p className="text-[10px] text-zinc-500 uppercase">{ind.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge sev={ind.severity} />
                    <span className="text-zinc-500 text-xs">{expandedIndicator === ind.id ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedIndicator === ind.id && (
                  <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-900/60">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Evidencia</p>
                      <p className="text-zinc-300 text-sm leading-relaxed">{ind.evidence}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Impacto</p>
                      <p className="text-zinc-400 text-sm">{ind.impact}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Fuente</p>
                      <p className="text-zinc-500 text-xs italic">{ind.source}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ind.verified ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
                      <span className="text-[10px] text-zinc-500 uppercase">{ind.verified ? "Verificado" : "Pendiente"}</span>
                      <span className="text-[10px] text-zinc-600">|</span>
                      <span className="text-[10px] text-zinc-500">{ind.status}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /> Línea Temporal</h3>
            <div className="space-y-3">
              {corruption.timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: t.severity > 70 ? '#ef4444' : t.severity > 0 ? '#f59e0b' : '#10b981' }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 font-bold">{t.date}</span>
                      <SeverityBadge sev={t.severity} />
                    </div>
                    <p className="text-zinc-300 text-sm mt-0.5">{t.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verdict Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-900/20 rounded-xl border border-emerald-500/20 p-5">
              <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Aspectos Positivos</h3>
              <ul className="space-y-2">{corruption.verdict.positives.map((p, i) => <li key={i} className="text-sm text-zinc-300 flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{p}</li>)}</ul>
            </div>
            <div className="bg-red-900/20 rounded-xl border border-red-500/20 p-5">
              <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Preocupaciones</h3>
              <ul className="space-y-2">{corruption.verdict.concerns.map((c, i) => <li key={i} className="text-sm text-zinc-300 flex items-start gap-2"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{c}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-zinc-700 text-[10px] uppercase tracking-widest pt-4 pb-2">
        © 2026 ONPE • Datos: Datum, Ipsos, CPI • Transparencia Electoral
      </footer>
    </main>
  );
}
