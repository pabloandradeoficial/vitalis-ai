import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Fisioterapeuta } from "@prisma/client";

/**
 * Busca o fisioterapeuta pelo clerkId.
 * Se não existir, cria automaticamente com os dados do Clerk.
 * Garante que o primeiro login nunca resulte em "Fisioterapeuta não encontrado".
 */
export async function getOrCreateFisio(userId: string): Promise<Fisioterapeuta> {
  const existente = await prisma.fisioterapeuta.findUnique({
    where: { clerkId: userId },
  });
  if (existente) return existente;

  // Busca dados do usuário no Clerk para popular o registro
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? `${userId}@sem-email.local`;

  const nome =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0];

  return prisma.fisioterapeuta.create({
    data: {
      clerkId: userId,
      nome,
      email,
    },
  });
}
