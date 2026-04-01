import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// GET /api/sessions?token=xxx — busca sessão pelo token (pública — paciente)
// GET /api/sessions — lista sessões do fisio autenticado
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token) {
    // Rota pública: paciente buscando sua sessão pelo link
    const sessao = await prisma.sessao.findUnique({
      where: { token },
      include: {
        paciente: { select: { nome: true } },
      },
    });

    if (!sessao) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    if (sessao.status === "EXPIRADA") {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 410 });
    }

    return NextResponse.json({
      id: sessao.id,
      exercicio: sessao.exercicio,
      descricao: sessao.descricao,
      repeticoesAlvo: sessao.repeticoesAlvo,
      paciente: sessao.paciente,
      status: sessao.status,
    });
  }

  // Rota autenticada: fisio listando pacientes/sessões
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

  const pacientes = await prisma.paciente.findMany({
    where: { fisioterapeutaId: fisio.id },
    include: {
      sessoes: {
        orderBy: { createdAt: "desc" },
        take: 7,
        include: { relatorio: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pacientes);
}

// POST /api/sessions — cria novo link de sessão (fisio autenticado)
export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { pacienteId, exercicio, descricao, repeticoesAlvo } = body;

  if (!pacienteId || !exercicio) {
    return NextResponse.json(
      { error: "pacienteId e exercicio são obrigatórios" },
      { status: 400 }
    );
  }

  // Verifica que o paciente pertence ao fisio
  const paciente = await prisma.paciente.findFirst({
    where: { id: pacienteId, fisioterapeutaId: fisio.id },
  });
  if (!paciente) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const sessao = await prisma.sessao.create({
    data: {
      pacienteId,
      exercicio,
      descricao: descricao || null,
      repeticoesAlvo: repeticoesAlvo || 10,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
  const link = `${baseUrl}/session/${sessao.token}`;

  return NextResponse.json({ sessao, link }, { status: 201 });
}

// PATCH /api/sessions — paciente salva dados da sessão após exercitar
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { token, repeticoes, tempoTotalMs } = body;

  if (!token || !repeticoes || !Array.isArray(repeticoes)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const sessao = await prisma.sessao.findUnique({ where: { token } });
  if (!sessao) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  // Salva repetições e atualiza sessão em transação
  const scores: number[] = repeticoes.map((r: { scoreExecucao: number }) => r.scoreExecucao);
  const scoreGeral = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  await prisma.$transaction([
    // Insere repetições
    prisma.repeticao.createMany({
      data: repeticoes.map((r: {
        numero: number;
        scoreExecucao: number;
        desviosDetectados: unknown;
        duracaoMs: number;
        anguloJoelhoMin?: number;
        anguloJoelhoMax?: number;
        anguloTronco?: number;
        simetria?: number;
      }) => ({
        sessaoId: sessao.id,
        numero: r.numero,
        scoreExecucao: r.scoreExecucao,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        desviosDetectados: r.desviosDetectados as any,
        duracaoMs: r.duracaoMs,
        anguloJoelhoMin: r.anguloJoelhoMin,
        anguloJoelhoMax: r.anguloJoelhoMax,
        anguloTronco: r.anguloTronco,
        simetria: r.simetria,
      })),
    }),

    // Atualiza status da sessão
    prisma.sessao.update({
      where: { id: sessao.id },
      data: {
        status: "CONCLUIDA",
        scoreGeral,
        iniciadaEm: sessao.iniciadaEm || new Date(Date.now() - tempoTotalMs),
        finalizadaEm: new Date(),
      },
    }),

    // Cria relatório
    prisma.relatorio.create({
      data: {
        sessaoId: sessao.id,
        scoreMediano: scoreGeral,
        scoreMinimo: Math.min(...scores),
        scoreMaximo: Math.max(...scores),
        totalRepeticoes: repeticoes.length,
        tempoTotalMs,
        desviosMaisFrequentes: calcularDesviosFrequentes(repeticoes),
        adesao: Math.min((repeticoes.length / sessao.repeticoesAlvo) * 100, 100),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

function calcularDesviosFrequentes(
  reps: { desviosDetectados: { tipo: string }[] | unknown }[]
): { tipo: string; count: number }[] {
  const contagem: Record<string, number> = {};

  reps.forEach((r) => {
    const desvios = Array.isArray(r.desviosDetectados) ? r.desviosDetectados : [];
    desvios.forEach((d: { tipo: string }) => {
      contagem[d.tipo] = (contagem[d.tipo] || 0) + 1;
    });
  });

  return Object.entries(contagem)
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
