import { NextResponse } from "next/server";
import { getComprehensiveElectionData } from "../comprehensive-data/route";
import { getCorruptionAnalysisData } from "../corruption-analysis/route";

export async function GET() {
  const comp = getComprehensiveElectionData();
  const bocaData = comp.bocaDeUrna;

  return NextResponse.json({
    current: {
      timestamp: Date.now(),
      status: `ENCUESTA DE SALIDA - ${bocaData.source} (${bocaData.time})`,
      percentCounted: 100,
      isExitPoll: true,
      isLiveScraped: false,
      source: bocaData.source,
      candidates: (bocaData.candidates || []).map((c: any, i: number) => ({
        id: i, name: c.name, party: c.party, votes: c.votes,
        percent: c.percent, color: c.color,
      })),
      totals: {
        valid: comp.totals.validVotes,
        blank: comp.totals.blankVotes,
        null: comp.totals.nullVotes,
        total: comp.totals.totalVotes,
      },
      message: `${bocaData.type}: ${bocaData.time}`,
    },
    source: "Boca de Urna - Datum",
    comprehensive: comp,
    corruption: getCorruptionAnalysisData(),
  });
}

export async function POST(request: Request) {
  return NextResponse.json({ success: true, message: "Data received (read-only mode)" });
}
