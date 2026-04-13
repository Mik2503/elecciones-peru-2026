// Push ALL election data sections to dashboard KV
// Run: node scripts/push-all-data.js
const { execSync } = require('child_process');

const allData = {
  timestamp: Date.now(),
  lastUpdate: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
  presidenciales: {
    totalActas: 92766, processedActas: 158, pendingActas: 92608, percent: 0.170,
    candidates: [
      { id: 0, name: "RAFAEL BERNARDO LOPEZ ALIAGA CAZORLA", party: "RENOVACION POPULAR", validPercent: 25.510, emitPercent: 22.577, votes: 7407, color: "#3b82f6" },
      { id: 1, name: "JORGE NIETO MONTESINOS", party: "PARTIDO DEL BUEN GOBIERNO", validPercent: 16.610, emitPercent: 14.701, votes: 4823, color: "#6366f1" },
      { id: 2, name: "KEIKO SOFIA FUJIMORI HIGUCHI", party: "FUERZA POPULAR", validPercent: 14.361, emitPercent: 12.710, votes: 4170, color: "#f97316" },
      { id: 3, name: "CARLOS GONSALO ALVAREZ LOAYZA", party: "PARTIDO PAIS PARA TODOS", validPercent: 8.979, emitPercent: 7.946, votes: 2607, color: "#a855f7" },
      { id: 4, name: "RICARDO PABLO BELMONT CASSINELLI", party: "PARTIDO CIVICO OBRAS", validPercent: 7.849, emitPercent: 6.946, votes: 2279, color: "#64748b" },
      { id: 5, name: "PABLO ALFONSO LOPEZ CHAU NAVA", party: "AHORA NACION - AN", validPercent: 6.798, emitPercent: 6.017, votes: 1974, color: "#84cc16" },
      { id: 6, name: "MARIA SOLEDAD PEREZ TELLO", party: "PRIMERO LA GENTE", validPercent: 4.987, emitPercent: 4.414, votes: 1448, color: "#facc15" },
      { id: 7, name: "ALFONSO CARLOS ESPA Y GARCES-ALVEAR", party: "PARTIDO SICREO", validPercent: 3.189, emitPercent: 2.822, votes: 926, color: "#e879f9" },
      { id: 8, name: "ROBERTO HELBERT SANCHEZ PALOMINO", party: "JUNTOS POR EL PERU", validPercent: 2.097, emitPercent: 1.856, votes: 609, color: "#ec4899" },
      { id: 9, name: "LUIS FERNANDO OLIVERA VEGA", party: "PARTIDO FRENTE DE LA ESPERANZA 2021", validPercent: 1.212, emitPercent: 1.073, votes: 352, color: "#22c55e" },
      { id: 10, name: "PITTER ENRIQUE VALDERRAMA PENA", party: "PARTIDO APRISTA PERUANO", validPercent: 1.054, emitPercent: 0.933, votes: 306, color: "#1e40af" },
      { id: 11, name: "ROBERTO ENRIQUE CHIABRA LEON", party: "UNIDAD NACIONAL", validPercent: 0.634, emitPercent: 0.561, votes: 184, color: "#1d4ed8" },
      { id: 12, name: "JOSE LEON LUNA GALVEZ", party: "PODEMOS PERU", validPercent: 0.616, emitPercent: 0.546, votes: 179, color: "#f59e0b" },
      { id: 13, name: "GEORGE PATRICK FORSYTH SOMMER", party: "PARTIDO DEMOCRATICO SOMOS PERU", validPercent: 0.568, emitPercent: 0.503, votes: 165, color: "#eab308" },
      { id: 14, name: "HERBERT CALLER GUTIERREZ", party: "PARTIDO PATRIOTICO DEL PERU", validPercent: 0.544, emitPercent: 0.482, votes: 158, color: "#78716c" },
      { id: 15, name: "WOLFGANG MARIO GROZO COSTA", party: "PARTIDO POLITICO INTEGRIDAD DEMOCRATICA", validPercent: 0.510, emitPercent: 0.451, votes: 148, color: "#c084fc" },
      { id: 16, name: "MESIAS ANTONIO GUEVARA AMASIFUEN", party: "PARTIDO MORADO", validPercent: 0.492, emitPercent: 0.436, votes: 143, color: "#8b5cf6" },
      { id: 17, name: "RONALD DARWIN ATENCIO SOTOMAYOR", party: "ALIANZA ELECTORAL VENCEREMOS", validPercent: 0.434, emitPercent: 0.384, votes: 126, color: "#0d9488" },
      { id: 18, name: "YONHY LESCANO ANCIETA", party: "PARTIDO POLITICO COOPERACION POPULAR", validPercent: 0.417, emitPercent: 0.369, votes: 121, color: "#14b8a6" },
      { id: 19, name: "ROSARIO DEL PILAR FERNANDEZ BAZAN", party: "UN CAMINO DIFERENTE", validPercent: 0.417, emitPercent: 0.369, votes: 121, color: "#94a3b8" },
      { id: 20, name: "MARIO ENRIQUE VIZCARRA CORNEJO", party: "PARTIDO POLITICO PERU PRIMERO", validPercent: 0.358, emitPercent: 0.317, votes: 104, color: "#fbbf24" },
      { id: 21, name: "CESAR ACUNA PERALTA", party: "ALIANZA PARA EL PROGRESO", validPercent: 0.344, emitPercent: 0.305, votes: 100, color: "#06b6d4" },
      { id: 22, name: "CHARLIE CARRASCO SALAZAR", party: "PARTIDO DEMOCRATA UNIDO PERU", validPercent: 0.313, emitPercent: 0.277, votes: 91, color: "#a3e635" },
      { id: 23, name: "RAFAEL JORGE BELAUNDE LLOSA", party: "LIBERTAD POPULAR", validPercent: 0.265, emitPercent: 0.235, votes: 77, color: "#0ea5e9" },
      { id: 24, name: "VLADIMIR ROY CERRON ROJAS", party: "PARTIDO POLITICO NACIONAL PERU LIBRE", validPercent: 0.241, emitPercent: 0.213, votes: 70, color: "#ef4444" },
      { id: 25, name: "PAUL DAVIS JAIMES BLANCO", party: "PROGRESEMOS", validPercent: 0.238, emitPercent: 0.210, votes: 69, color: "#a78bfa" },
      { id: 26, name: "ALEX GONZALES CASTILLO", party: "PARTIDO DEMOCRATA VERDE", validPercent: 0.200, emitPercent: 0.177, votes: 58, color: "#4ade80" },
      { id: 27, name: "JOSE DANIEL WILLIAMS ZAPATA", party: "AVANZA PAIS", validPercent: 0.196, emitPercent: 0.174, votes: 57, color: "#34d399" },
      { id: 28, name: "FIORELLA GIANNINA MOLINELLI ARISTONDO", party: "FUERZA Y LIBERTAD", validPercent: 0.124, emitPercent: 0.110, votes: 36, color: "#f43f5e" },
      { id: 29, name: "FRANCISCO ERNESTO DIEZ-CANSECO TAVARA", party: "PARTIDO POLITICO PERU ACCION", validPercent: 0.103, emitPercent: 0.091, votes: 30, color: "#fb923c" },
      { id: 30, name: "ALVARO GONZALO PAZ DE LA BARRA FREIGEIRO", party: "FE EN EL PERU", validPercent: 0.093, emitPercent: 0.082, votes: 27, color: "#c2410c" },
      { id: 31, name: "CARLOS ERNESTO JAICO CARRANZA", party: "PERU MODERNO", validPercent: 0.069, emitPercent: 0.061, votes: 20, color: "#22d3ee" },
      { id: 32, name: "ARMANDO JOAQUIN MASSE FERNANDEZ", party: "PARTIDO DEMOCRATICO FEDERAL", validPercent: 0.052, emitPercent: 0.046, votes: 15, color: "#2dd4bf" },
      { id: 33, name: "WALTER GILMER CHIRINOS PURIZAGA", party: "PARTIDO POLITICO PRIN", validPercent: 0.048, emitPercent: 0.043, votes: 14, color: "#38bdf8" },
      { id: 34, name: "ANTONIO ORTIZ VILLANO", party: "SALVEMOS AL PERU", validPercent: 0.041, emitPercent: 0.037, votes: 12, color: "#fb7185" },
      { id: 35, name: "NAPOLEON BECERRA GARCIA", party: "PARTIDO DE LOS TRABAJADORES Y EMPRENDEDORES", validPercent: 0.034, emitPercent: 0.030, votes: 10, color: "#dc2626" }
    ],
    totals: { validVotes: 29036, blankVotes: 2772, nullVotes: 1000, totalVotes: 32808 }
  },
  senadoresUnico: {
    totalActas: 92766, percent: 0.004,
    parties: [
      { name: "RENOVACION POPULAR", candidates: 4, validPercent: 25.2, emitPercent: 22.1, votes: 8276, color: "#3b82f6" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 4, validPercent: 16.8, emitPercent: 14.9, votes: 5510, color: "#6366f1" },
      { name: "FUERZA POPULAR", candidates: 4, validPercent: 14.5, emitPercent: 12.8, votes: 4756, color: "#f97316" },
      { name: "PARTIDO PAIS PARA TODOS", candidates: 4, validPercent: 9.1, emitPercent: 8.0, votes: 2984, color: "#a855f7" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 4, validPercent: 7.9, emitPercent: 7.0, votes: 2591, color: "#64748b" },
      { name: "AHORA NACION - AN", candidates: 3, validPercent: 6.8, emitPercent: 6.0, votes: 2230, color: "#84cc16" },
      { name: "PRIMERO LA GENTE", candidates: 4, validPercent: 5.0, emitPercent: 4.4, votes: 1640, color: "#facc15" },
      { name: "PARTIDO SICREO", candidates: 3, validPercent: 3.2, emitPercent: 2.8, votes: 1050, color: "#e879f9" }
    ]
  },
  senadoresMultiple: {
    totalActas: 26368, percent: 0.046,
    parties: [
      { name: "ALIANZA ELECTORAL VENCEREMOS", candidates: 4, validPercent: 18.5, emitPercent: 16.2, votes: 1205, color: "#0d9488" },
      { name: "PARTIDO PATRIOTICO DEL PERU", candidates: 4, validPercent: 14.2, emitPercent: 12.5, votes: 925, color: "#78716c" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 4, validPercent: 12.8, emitPercent: 11.2, votes: 834, color: "#64748b" },
      { name: "FRENTE POPULAR AGRICOLA FIA DEL PERU", candidates: 4, validPercent: 10.5, emitPercent: 9.2, votes: 684, color: "#16a34a" },
      { name: "PARTIDO DEMOCRATA VERDE", candidates: 3, validPercent: 8.9, emitPercent: 7.8, votes: 580, color: "#4ade80" }
    ]
  },
  diputados: {
    totalActas: 26368, percent: 0.033,
    parties: [
      { name: "ALIANZA ELECTORAL VENCEREMOS", candidates: 32, validPercent: 17.8, emitPercent: 15.6, votes: 1158, color: "#0d9488" },
      { name: "PARTIDO PATRIOTICO DEL PERU", candidates: 32, validPercent: 13.9, emitPercent: 12.2, votes: 905, color: "#78716c" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 30, validPercent: 12.1, emitPercent: 10.6, votes: 788, color: "#64748b" },
      { name: "FRENTE POPULAR AGRICOLA FIA DEL PERU", candidates: 32, validPercent: 10.2, emitPercent: 8.9, votes: 664, color: "#16a34a" },
      { name: "PARTIDO DEMOCRATA VERDE", candidates: 31, validPercent: 9.1, emitPercent: 8.0, votes: 593, color: "#4ade80" }
    ]
  },
  parlamentoAndino: {
    percent: 0.033,
    parties: [
      { name: "RENOVACION POPULAR", candidates: 14, validPercent: 23.524, emitPercent: 17.102, votes: 956, color: "#3b82f6" },
      { name: "PARTIDO DEL BUEN GOBIERNO", candidates: 16, validPercent: 15.797, emitPercent: 11.485, votes: 642, color: "#6366f1" },
      { name: "FUERZA POPULAR", candidates: 14, validPercent: 10.236, emitPercent: 7.442, votes: 416, color: "#f97316" },
      { name: "PARTIDO CIVICO OBRAS", candidates: 10, validPercent: 10.039, emitPercent: 7.299, votes: 408, color: "#64748b" },
      { name: "PARTIDO PAIS PARA TODOS", candidates: 9, validPercent: 9.793, emitPercent: 7.120, votes: 398, color: "#a855f7" },
      { name: "AHORA NACION - AN", candidates: 16, validPercent: 9.031, emitPercent: 6.565, votes: 367, color: "#84cc16" },
      { name: "PRIMERO LA GENTE", candidates: 13, validPercent: 5.635, emitPercent: 4.097, votes: 229, color: "#facc15" },
      { name: "PARTIDO APRISTA PERUANO", candidates: 16, validPercent: 2.165, emitPercent: 1.574, votes: 88, color: "#1e40af" },
      { name: "JUNTOS POR EL PERU", candidates: 13, validPercent: 1.870, emitPercent: 1.360, votes: 76, color: "#ec4899" }
    ],
    totals: { validVotes: 4064, blankVotes: 651, nullVotes: 875, totalVotes: 5590 }
  },
  participacion: {
    electoresHabiles: 27325432, totalAsistentes: 32808, totalAusentes: 21185,
    asistentesPercent: 0.120, ausentesPercent: 0.078, pendientesPercent: 99.802,
    exteriorAsistentes: 0.678, peruAsistentes: 0.094
  },
  actas: {
    presidencial: { total: 92766, percent: 0.170, processed: 158, pending: 92608, pendingPercent: 99.830 },
    senadoresUnico: { total: 92766, percent: 0.004, processed: 4, pending: 92762, pendingPercent: 99.996 },
    senadoresMultiple: { total: 92766, percent: 0.046, processed: 43, pending: 92723, pendingPercent: 99.954 },
    diputados: { total: 92766, percent: 0.033, processed: 31, pending: 92735, pendingPercent: 99.967 },
    parlamentoAndino: { total: 92766, percent: 0.033, processed: 31, pending: 92735, pendingPercent: 99.967 }
  }
};

// Push to dashboard
async function push() {
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://elecciones-peru-2026-peach.vercel.app';
  try {
    const res = await fetch(`${dashboardUrl}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allData)
    });
    const result = await res.json();
    console.log('PUSH RESULT:', result);
  } catch (err) {
    console.error('PUSH ERROR:', err.message);
  }
}

push();
