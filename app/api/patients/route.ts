import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// POST /api/patients — cria paciente vinculado ao fisio autenticado
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
  const { nome, telefone, email } = body;

  if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const paciente = await prisma.paciente.create({
    data: {
      nome: nome.trim(),
      telefone: telefone?.trim() || null,
      email: email?.trim() || null,
      fisioterapeutaId: fisio.id,
    },
  });

  return NextResponse.json(paciente, { status: 201 });
}
