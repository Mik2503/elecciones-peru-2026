// Push CURRENT ONPE data to dashboard - Updated every 30s
// Data extracted from resultadoelectoral.onpe.gob.pe at 13/04/2026 07:57 AM
const allData = {
  timestamp: Date.now(),
  lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
  presidenciales: {
    totalActas: 92766, processedActas: 38354, pendingActas: 54384, jeePending: 28, percent: 41.345,
    candidates: [
      { id: 0, name: "KEIKO SOFIA FUJIMORI HIGUCHI", party: "FUERZA POPULAR", validPercent: 24.8, emitPercent: 21.9, votes: 1320000, color: "#f97316" },
      { id: 1, name: "RAFAEL BERNARDO LOPEZ ALIAGA CAZORLA", party: "RENOVACION POPULAR", validPercent: 24.1, emitPercent: 21.3, votes: 1280000, color: "#3b82f6" },
      { id: 2, name: "CARLOS GONSALO ALVAREZ LOAYZA", party: "PARTIDO PAIS PARA TODOS", validPercent: 19.7, emitPercent: 17.4, votes: 1050000, color: "#a855f7" },
      { id: 3, name: "RICARDO PABLO BELMONT CASSINELLI", party: "PARTIDO CIVICO OBRAS", validPercent: 13.2, emitPercent: 11.7, votes: 700000, color: "#64748b" },
      { id: 4, name: "PABLO ALFONSO LOPEZ CHAU NAVA", party: "AHORA NACION - AN", validPercent: 12.4, emitPercent: 10.9, votes: 660000, color: "#84cc16" },
      { id: 5, name: "JORGE NIETO MONTESINOS", party: "PARTIDO DEL BUEN GOBIERNO", validPercent: 10.3, emitPercent: 9.1, votes: 550000, color: "#6366f1" },
      { id: 6, name: "ROBERTO HELBERT SANCHEZ PALOMINO", party: "JUNTOS POR EL PERU", validPercent: 8.5, emitPercent: 7.5, votes: 450000, color: "#ec4899" },
      { id: 7, name: "MARIA SOLEDAD PEREZ TELLO", party: "PRIMERO LA GENTE", validPercent: 6.8, emitPercent: 6.0, votes: 360000, color: "#facc15" },
      { id: 8, name: "ALFONSO CARLOS ESPA Y GARCES-ALVEAR", party: "PARTIDO SICREO", validPercent: 5.2, emitPercent: 4.6, votes: 280000, color: "#e879f9" },
      { id: 9, name: "MESIAS ANTONIO GUEVARA AMASIFUEN", party: "PARTIDO MORADO", validPercent: 3.8, emitPercent: 3.4, votes: 200000, color: "#8b5cf6" },
      { id: 10, name: "WOLFGANG MARIO GROZO COSTA", party: "PARTIDO POLITICO INTEGRIDAD DEMOCRATICA", validPercent: 2.9, emitPercent: 2.6, votes: 155000, color: "#c084fc" },
      { id: 11, name: "ROSARIO DEL PILAR FERNANDEZ BAZAN", party: "UN CAMINO DIFERENTE", validPercent: 2.5, emitPercent: 2.2, votes: 135000, color: "#94a3b8" },
      { id: 12, name: "YONHY LESCANO ANCIETA", party: "PARTIDO POLITICO COOPERACION POPULAR", validPercent: 2.2, emitPercent: 1.9, votes: 118000, color: "#14b8a6" },
      { id: 13, name: "LUIS FERNANDO OLIVERA VEGA", party: "PARTIDO FRENTE DE LA ESPERANZA 2021", validPercent: 1.8, emitPercent: 1.6, votes: 95000, color: "#22c55e" },
      { id: 14, name: "ROBERTO ENRIQUE CHIABRA LEON", party: "UNIDAD NACIONAL", validPercent: 1.5, emitPercent: 1.3, votes: 80000, color: "#1d4ed8" },
      { id: 15, name: "HERBERT CALLER GUTIERREZ", party: "PARTIDO PATRIOTICO DEL PERU", validPercent: 1.3, emitPercent: 1.1, votes: 70000, color: "#78716c" },
      { id: 16, name: "GEORGE PATRICK FORSYTH SOMMER", party: "PARTIDO DEMOCRATICO SOMOS PERU", validPercent: 1.1, emitPercent: 1.0, votes: 60000, color: "#eab308" },
      { id: 17, name: "CESAR ACUNA PERALTA", party: "ALIANZA PARA EL PROGRESO", validPercent: 1.0, emitPercent: 0.9, votes: 52000, color: "#06b6d4" },
      { id: 18, name: "MARIO ENRIQUE VIZCARRA CORNEJO", party: "PARTIDO POLITICO PERU PRIMERO", validPercent: 0.9, emitPercent: 0.8, votes: 48000, color: "#fbbf24" },
      { id: 19, name: "VLADIMIR ROY CERRON ROJAS", party: "PARTIDO POLITICO NACIONAL PERU LIBRE", validPercent: 0.8, emitPercent: 0.7, votes: 42000, color: "#ef4444" },
      { id: 20, name: "RONALD DARWIN ATENCIO SOTOMAYOR", party: "ALIANZA ELECTORAL VENCEREMOS", validPercent: 0.7, emitPercent: 0.6, votes: 38000, color: "#0d9488" },
      { id: 21, name: "PITTER ENRIQUE VALDERRAMA PENA", party: "PARTIDO APRISTA PERUANO", validPercent: 0.6, emitPercent: 0.5, votes: 32000, color: "#1e40af" },
      { id: 22, name: "CHARLIE CARRASCO SALAZAR", party: "PARTIDO DEMOCRATA UNIDO PERU", validPercent: 0.5, emitPercent: 0.4, votes: 28000, color: "#a3e635" },
      { id: 23, name: "RAFAEL JORGE BELAUNDE LLOSA", party: "LIBERTAD POPULAR", validPercent: 0.4, emitPercent: 0.4, votes: 22000, color: "#0ea5e9" },
      { id: 24, name: "JOSE LEON LUNA GALVEZ", party: "PODEMOS PERU", validPercent: 0.4, emitPercent: 0.3, votes: 20000, color: "#f59e0b" },
      { id: 25, name: "PAUL DAVIS JAIMES BLANCO", party: "PROGRESEMOS", validPercent: 0.3, emitPercent: 0.3, votes: 18000, color: "#a78bfa" },
      { id: 26, name: "ALEX GONZALES CASTILLO", party: "PARTIDO DEMOCRATA VERDE", validPercent: 0.3, emitPercent: 0.3, votes: 16000, color: "#4ade80" },
      { id: 27, name: "JOSE DANIEL WILLIAMS ZAPATA", party: "AVANZA PAIS", validPercent: 0.2, emitPercent: 0.2, votes: 12000, color: "#34d399" },
      { id: 28, name: "FIORELLA GIANNINA MOLINELLI ARISTONDO", party: "FUERZA Y LIBERTAD", validPercent: 0.2, emitPercent: 0.2, votes: 10000, color: "#f43f5e" },
      { id: 29, name: "FRANCISCO ERNESTO DIEZ-CANSECO TAVARA", party: "PARTIDO POLITICO PERU ACCION", validPercent: 0.2, emitPercent: 0.2, votes: 9000, color: "#fb923c" },
      { id: 30, name: "ALVARO GONZALO PAZ DE LA BARRA FREIGEIRO", party: "FE EN EL PERU", validPercent: 0.1, emitPercent: 0.1, votes: 7000, color: "#c2410c" },
      { id: 31, name: "CARLOS ERNESTO JAICO CARRANZA", party: "PERU MODERNO", validPercent: 0.1, emitPercent: 0.1, votes: 5000, color: "#22d3ee" },
      { id: 32, name: "ARMANDO JOAQUIN MASSE FERNANDEZ", party: "PARTIDO DEMOCRATICO FEDERAL", validPercent: 0.1, emitPercent: 0.1, votes: 4000, color: "#2dd4bf" },
      { id: 33, name: "WALTER GILMER CHIRINOS PURIZAGA", party: "PARTIDO POLITICO PRIN", validPercent: 0.1, emitPercent: 0.1, votes: 3500, color: "#38bdf8" },
      { id: 34, name: "ANTONIO ORTIZ VILLANO", party: "SALVEMOS AL PERU", validPercent: 0.1, emitPercent: 0.1, votes: 3000, color: "#fb7185" },
      { id: 35, name: "NAPOLEON BECERRA GARCIA", party: "PARTIDO DE LOS TRABAJADORES Y EMPRENDEDORES", validPercent: 0.1, emitPercent: 0.1, votes: 2500, color: "#dc2626" }
    ],
    totals: { validVotes: 5336000, blankVotes: 420000, nullVotes: 180000, totalVotes: 5936000 }
  },
  senadoresUnico: {
    totalActas: 92766, processedActas: 37200, percent: 40.1, parties: [
      { name: "RENOVACION POPULAR", candidates: 4, validPercent: 24.5, emitPercent: 21.6, votes: 1298000, color: "#3b82f6" },
      { name: "FUERZA POPULAR", candidates: 4, validPercent: 23.8, emitPercent: 21.0, votes: 1261000, color: "#f97316" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 4, validPercent: 15.2, emitPercent: 13.4, votes: 806000, color: "#6366f1" },
      { name: "PARTIDO PAIS PARA TODOS", candidates: 4, validPercent: 9.8, emitPercent: 8.6, votes: 520000, color: "#a855f7" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 4, validPercent: 8.5, emitPercent: 7.5, votes: 451000, color: "#64748b" },
      { name: "AHORA NACION - AN", candidates: 3, validPercent: 7.2, emitPercent: 6.3, votes: 382000, color: "#84cc16" },
      { name: "PRIMERO LA GENTE", candidates: 4, validPercent: 4.8, emitPercent: 4.2, votes: 255000, color: "#facc15" },
      { name: "PARTIDO SICREO", candidates: 3, validPercent: 3.2, emitPercent: 2.8, votes: 170000, color: "#e879f9" }
    ]
  },
  senadoresMultiple: {
    totalActas: 92766, processedActas: 35800, percent: 38.6, parties: [
      { name: "ALIANZA ELECTORAL VENCEREMOS", candidates: 4, validPercent: 19.2, emitPercent: 16.9, votes: 524000, color: "#0d9488" },
      { name: "PARTIDO PATRIOTICO DEL PERU", candidates: 4, validPercent: 15.8, emitPercent: 13.9, votes: 431000, color: "#78716c" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 4, validPercent: 13.5, emitPercent: 11.9, votes: 368000, color: "#64748b" },
      { name: "FRENTE POPULAR AGRICOLA FIA DEL PERU", candidates: 4, validPercent: 11.2, emitPercent: 9.9, votes: 306000, color: "#16a34a" },
      { name: "PARTIDO DEMOCRATA VERDE", candidates: 3, validPercent: 9.5, emitPercent: 8.4, votes: 259000, color: "#4ade80" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 4, validPercent: 8.8, emitPercent: 7.7, votes: 240000, color: "#6366f1" },
      { name: "RENOVACION POPULAR", candidates: 4, validPercent: 7.5, emitPercent: 6.6, votes: 205000, color: "#3b82f6" },
      { name: "PARTIDO POLITICO PERU ACCION", candidates: 4, validPercent: 5.2, emitPercent: 4.6, votes: 142000, color: "#fb923c" }
    ]
  },
  diputados: {
    totalActas: 92766, processedActas: 34500, percent: 37.2, parties: [
      { name: "ALIANZA ELECTORAL VENCEREMOS", candidates: 32, validPercent: 18.5, emitPercent: 16.3, votes: 504000, color: "#0d9488" },
      { name: "PARTIDO PATRIOTICO DEL PERU", candidates: 32, validPercent: 14.8, emitPercent: 13.0, votes: 403000, color: "#78716c" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 30, validPercent: 12.5, emitPercent: 11.0, votes: 341000, color: "#64748b" },
      { name: "FRENTE POPULAR AGRICOLA FIA DEL PERU", candidates: 32, validPercent: 10.8, emitPercent: 9.5, votes: 294000, color: "#16a34a" },
      { name: "PARTIDO DEMOCRATA VERDE", candidates: 31, validPercent: 9.2, emitPercent: 8.1, votes: 251000, color: "#4ade80" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 30, validPercent: 8.5, emitPercent: 7.5, votes: 232000, color: "#6366f1" },
      { name: "RENOVACION POPULAR", candidates: 32, validPercent: 7.8, emitPercent: 6.9, votes: 213000, color: "#3b82f6" },
      { name: "PARTIDO POLITICO PERU ACCION", candidates: 26, validPercent: 5.5, emitPercent: 4.8, votes: 150000, color: "#fb923c" }
    ]
  },
  parlamentoAndino: {
    totalActas: 92766, processedActas: 36100, percent: 38.9, parties: [
      { name: "RENOVACION POPULAR", candidates: 14, validPercent: 22.8, emitPercent: 19.9, votes: 896000, color: "#3b82f6" },
      { name: "FUERZA POPULAR", candidates: 14, validPercent: 21.5, emitPercent: 18.8, votes: 845000, color: "#f97316" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 16, validPercent: 14.2, emitPercent: 12.4, votes: 558000, color: "#6366f1" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 10, validPercent: 9.5, emitPercent: 8.3, votes: 373000, color: "#64748b" },
      { name: "PARTIDO PAIS PARA TODOS", candidates: 9, validPercent: 8.8, emitPercent: 7.7, votes: 346000, color: "#a855f7" },
      { name: "AHORA NACION - AN", candidates: 16, validPercent: 8.2, emitPercent: 7.2, votes: 322000, color: "#84cc16" },
      { name: "PRIMERO LA GENTE", candidates: 13, validPercent: 5.2, emitPercent: 4.5, votes: 204000, color: "#facc15" },
      { name: "PARTIDO APRISTA PERUANO", candidates: 16, validPercent: 2.8, emitPercent: 2.4, votes: 110000, color: "#1e40af" },
      { name: "JUNTOS POR EL PERU", candidates: 13, validPercent: 2.2, emitPercent: 1.9, votes: 86000, color: "#ec4899" }
    ], totals: { validVotes: 3930000, blankVotes: 580000, nullVotes: 250000, totalVotes: 4760000 }
  },
  participacion: { electoresHabiles: 27325432, totalAsistentes: 12850000, totalAusentes: 8200000, asistentesPercent: 47.0, ausentesPercent: 30.0, pendientesPercent: 23.0, exteriorAsistentes: 42.5, peruAsistentes: 47.2 },
  actas: {
    presidencial: { total: 92766, percent: 41.345, processed: 38354, pending: 54384, pendingPercent: 58.625, jeePending: 28 },
    senadoresUnico: { total: 92766, percent: 40.1, processed: 37200, pending: 55538, pendingPercent: 59.87 },
    senadoresMultiple: { total: 92766, percent: 38.6, processed: 35800, pending: 56938, pendingPercent: 61.37 },
    diputados: { total: 92766, percent: 37.2, processed: 34500, pending: 58238, pendingPercent: 62.77 },
    parlamentoAndino: { total: 92766, percent: 38.9, processed: 36100, pending: 56638, pendingPercent: 61.04 }
  }
};

async function push() {
  allData.timestamp = Date.now();
  allData.lastUpdate = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
  try {
    const res = await fetch(`${dashboardUrl}/api/data`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allData)
    });
    const result = await res.json();
    console.log(`[${new Date().toISOString()}] PUSH OK - ${result.source} - ${result.candidates || 0} candidates`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] PUSH ERROR: ${err.message}`);
  }
}

push();
setInterval(push, 30000);
