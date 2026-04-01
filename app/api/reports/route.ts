import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// GET /api/reports?pacienteId=xxx — relatório de um paciente (fisio autenticado)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const fisio = await prisma.fisioterapeuta.findUnique({
    where: { clerkId: userId },
  });
  if (!fisio) {
    return NextResponse.json({ error: "Fisioterapeuta não encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const pacienteId = searchParams.get("pacienteId");

  if (!pacienteId) {
    return NextResponse.json({ error: "pacienteId obrigatório" }, { status: 400 });
  }

  // Verifica que o paciente pertence ao fisio
  const paciente = await prisma.paciente.findFirst({
    where: { id: pacienteId, fisioterapeutaId: fisio.id },
  });
  if (!paciente) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const sessoes = await prisma.sessao.findMany({
    where: { pacienteId },
    include: {
      relatorio: true,
      repeticoes: {
        orderBy: { numero: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Métricas agregadas das últimas 7 sessões concluídas
  const concluidasRecentes = sessoes
    .filter((s) => s.status === "CONCLUIDA" && s.relatorio !== null)
    .slice(0, 7) as Array<(typeof sessoes)[number] & { relatorio: NonNullable<(typeof sessoes)[number]["relatorio"]> }>;

  const scoresMedios = concluidasRecentes.map((s) => s.relatorio.scoreMediano);
  const mediaGeral =
    scoresMedios.length > 0
      ? scoresMedios.reduce((a, b) => a + b, 0) / scoresMedios.length
      : null;

  const adesaoMedia =
    concluidasRecentes.length > 0
      ? concluidasRecentes.reduce((acc, s) => acc + s.relatorio.adesao, 0) /
        concluidasRecentes.length
      : null;

  // Alerta: queda de score > 15 pontos nas últimas 2 sessões
  let alertaQueda = false;
  if (scoresMedios.length >= 2) {
    alertaQueda = scoresMedios[0] - scoresMedios[1] < -15;
  }

  return NextResponse.json({
    paciente,
    sessoes,
    metricas: {
      scoreUltimas7: scoresMedios,
      mediaGeral,
      adesaoMedia,
      alertaQueda,
      totalSessoes: sessoes.length,
      sessoesConcluidasRecentes: concluidasRecentes.length,
    },
  });
}
