"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ReferenceLine,
  Label
} from "recharts";
import { TrendingUp, Users, FileText, AlertCircle, RefreshCcw, CheckCircle2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Utility for Tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Types */
interface Candidate {
  id: number;
  name: string;
  party: string;
  votes: number;
  color: string;
}

interface ElectionData {
  timestamp: number;
  percentCounted: number;
  candidates: Candidate[];
  totals: {
    valid: number;
    blank: number;
    null: number;
    total: number;
  };
}

/** Components */

// 1. Circular Progress Widget
const CircularProgress = ({ value, label }: { value: number; label: string }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          className="text-zinc-800"
        />
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{value}%</span>
        <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
};

// 2. Stat Card
const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
  <div className="glass-card p-6 flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className={cn("p-3 rounded-xl bg-opacity-10", color)}>
      <Icon className={cn("w-6 h-6", color.replace("bg-", "text-"))} />
    </div>
    <div>
      <p className="text-sm text-zinc-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </div>
);

// 3. Custom Tooltip for the "Duelo" line
const GapTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-red-900/90 border border-red-500/50 p-2 rounded-md shadow-lg backdrop-blur-sm">
        <p className="text-xs font-bold text-white">DIFERENCIA</p>
        <p className="text-sm text-red-100">{payload[0].value.toLocaleString()} votos</p>
      </div>
    );
  }
  return null;
};

/** Main Application */
export default function ElectoralDashboard() {
  const [data, setData] = useState<{ current: ElectionData | null; history: ElectionData[] }>({
    current: null,
    history: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      const json = await res.json();
      if (json.current) {
        setData(json);
        setError(null);
      } else {
        // If no data in KV, tell the user we are waiting for official sync
        setError("Esperando datos oficiales de ONPE...");
      }
    } catch {
      setError("Error de conexión con el centro de datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Pulse check every minute
    return () => clearInterval(interval);
  }, []);

  // Derived data for charts
  const barData = useMemo(() => {
    if (!data.current) return [];
    return data.current.candidates.map(c => ({
      name: c.name,
      votos: c.votes,
      color: c.color,
      shortName: c.name.split(" ").pop()
    }));
  }, [data.current]);

  const lineData = useMemo(() => {
    if (data.history.length === 0) return [];
    return data.history.map(h => {
      const entry: any = { time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      h.candidates.slice(0, 3).forEach(c => {
        entry[c.name] = c.votes;
      });
      return entry;
    });
  }, [data.history]);

  // Calculate position and gap for the red line
  const duelLine = useMemo(() => {
    if (barData.length < 2) return null;
    const first = barData[0];
    const second = barData[1];
    const diff = first.votos - second.votos;
    // We position it exactly at the midpoint between 1st and 2nd bar index (0.5 if sorted)
    // Actually, Recharts positioning for ReferenceLine is based on scale value or string.
    // We'll use the midpoint between the two candidates on the X scale if possible or just show stats.
    return { diff, first, second };
  }, [barData]);

  if (loading && !data.current) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white">Sincronizando con ONPE...</h2>
          <p className="text-zinc-500 mt-2">Cargando base de datos en tiempo real</p>
        </div>
      </div>
    );
  }

  if (error && !data.current) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Esperando Datos Oficiales</h2>
          <p className="text-zinc-400 mb-4">{error}</p>
          <div className="text-zinc-500 text-sm space-y-2 text-left bg-zinc-900/50 p-4 rounded-lg">
            <p><strong className="text-zinc-300">Situación:</strong> La ONPE bloquea peticiones desde servidores cloud (Vercel). Se requiere ejecutar la sincronización desde una IP residencial de Perú.</p>
            <p><strong className="text-zinc-300">Candidatos 2026:</strong> 35 candidatos presidenciales oficiales incluyendo Keiko Fujimori, Rafael López Aliaga, Carlos Álvarez, Alfonso López Chau, César Acuña, George Forsyth, Vladimir Cerrón, entre otros.</p>
            <p><strong className="text-zinc-300">Solución:</strong> Ejecutar Docker Sync desde una máquina con IP peruana para obtener datos reales de la ONPE.</p>
          </div>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData(); }}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  const current = data.current!;

  return (
    <main className="min-h-screen p-4 md:p-8 space-y-8 animate-in fade-in duration-1000">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
              Dashboard <span className="text-red-500">Electoral</span>
            </h1>
            <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded-full animate-pulse uppercase tracking-widest shadow-[0_0_10px_rgba(220,38,38,0.5)]">
              12 ABRIL 2026
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-1 flex items-center gap-2">
            Elecciones Generales Perú • Corte: {new Date(current.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Estado Servidor</p>
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Conectado a Vercel KV
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Progress & Cards */}
        <div className="xl:col-span-4 space-y-6">
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-4">
            <CircularProgress
              value={current.percentCounted > 0 ? current.percentCounted : (current as any).percentInstalled || 0}
              label={current.percentCounted > 0 ? "Actas Contabilizadas" : "Mesas Instaladas (OFICIAL)"}
            />
            <div className="text-center mt-2">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-bold italic">
                {(current as any).status || "Estado de Jornada"}
              </p>
              <p className="text-zinc-300 text-sm mt-1">
                {(current as any).message || `${current.totals.total.toLocaleString()} votos totales`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <StatCard
              title="Votos Emitidos"
              value={current.totals.valid.toLocaleString()}
              icon={Users}
              color="bg-blue-500"
            />
            <StatCard
              title="Votos Blancos"
              value={current.totals.blank.toLocaleString()}
              icon={FileText}
              color="bg-zinc-500"
            />
            <StatCard
              title="Votos Nulos"
              value={current.totals.null.toLocaleString()}
              icon={AlertCircle}
              color="bg-red-500"
            />
          </div>
        </div>

        {/* Right Column: Charts */}
        <div className="xl:col-span-8 space-y-6">
          {/* Bar Chart - The Duel */}
          <div className="glass-card p-6 h-[450px] relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 italic uppercase">
                <TrendingUp className="w-5 h-5 text-red-500" /> El Duelo Presidencial
              </h2>
              {duelLine && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-950/50 border border-red-500/30 rounded-lg">
                  <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider">Brecha:</span>
                  <span className="text-sm font-black text-red-100">{duelLine.diff.toLocaleString()} votos</span>
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={barData} layout="vertical" margin={{ left: 40, right: 40, top: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#71717a', fontSize: 12, fontWeight: 'bold' }}
                  width={150}
                />
                <Tooltip
                  cursor={{ fill: '#1f1f23' }}
                  contentStyle={{ backgroundColor: '#121214', border: '1px solid #1f1f23', borderRadius: '8px' }}
                />
                <Bar dataKey="votos" radius={[0, 4, 4, 0]} barSize={40}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={index === 0 ? 1 : 0.6} />
                  ))}
                </Bar>

                {/* Visual Gap Representation */}
                {barData.length > 1 && (
                  <ReferenceLine
                    y={barData[0].name}
                    stroke="transparent"
                  >
                    <Label
                      position="top"
                      content={() => (
                        <foreignObject x="60%" y="25%" width="120" height="60">
                          <div className="border-l-2 border-red-500 h-24 flex flex-col justify-center pl-3 animate-pulse">
                            <p className="text-[10px] text-red-500 font-bold">DIFERENCIA</p>
                            <p className="text-xs text-white font-black">{duelLine?.diff.toLocaleString()} VOTOS</p>
                          </div>
                        </foreignObject>
                      )}
                    />
                  </ReferenceLine>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart - Trend */}
          <div className="glass-card p-6 h-[350px]">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 italic uppercase">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Histórico de Tendencia
            </h2>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121214', border: '1px solid #1f1f23', borderRadius: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                {data.current?.candidates.slice(0, 3).map((candidate, i) => (
                  <Line
                    key={candidate.id}
                    type="monotone"
                    dataKey={candidate.name}
                    stroke={candidate.color}
                    strokeWidth={i === 0 ? 3 : 1.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <footer className="text-center text-zinc-600 text-[10px] uppercase tracking-[0.3em] font-medium pt-8">
        © 2026 ONPE • Desarrollo de Alta Disponibilidad • Vercel Edge Framework
      </footer>
    </main>
  );
}
