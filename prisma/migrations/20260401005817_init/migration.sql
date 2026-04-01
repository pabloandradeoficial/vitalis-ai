-- CreateEnum
CREATE TYPE "StatusSessao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "fisioterapeutas" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "crm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fisioterapeutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "fisioterapeutaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "exercicio" TEXT NOT NULL,
    "descricao" TEXT,
    "repeticoesAlvo" INTEGER NOT NULL DEFAULT 10,
    "status" "StatusSessao" NOT NULL DEFAULT 'PENDENTE',
    "scoreGeral" DOUBLE PRECISION,
    "iniciadaEm" TIMESTAMP(3),
    "finalizadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repeticoes" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoreExecucao" DOUBLE PRECISION NOT NULL,
    "desviosDetectados" JSONB NOT NULL DEFAULT '[]',
    "duracaoMs" INTEGER NOT NULL,
    "anguloJoelhoMin" DOUBLE PRECISION,
    "anguloJoelhoMax" DOUBLE PRECISION,
    "anguloTronco" DOUBLE PRECISION,
    "simetria" DOUBLE PRECISION,

    CONSTRAINT "repeticoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "scoreMediano" DOUBLE PRECISION NOT NULL,
    "scoreMinimo" DOUBLE PRECISION NOT NULL,
    "scoreMaximo" DOUBLE PRECISION NOT NULL,
    "totalRepeticoes" INTEGER NOT NULL,
    "tempoTotalMs" INTEGER NOT NULL,
    "desviosMaisFrequentes" JSONB NOT NULL DEFAULT '[]',
    "adesao" DOUBLE PRECISION NOT NULL,
    "observacoesIA" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fisioterapeutas_clerkId_key" ON "fisioterapeutas"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "fisioterapeutas_email_key" ON "fisioterapeutas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_key" ON "sessoes"("token");

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_sessaoId_key" ON "relatorios"("sessaoId");

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "fisioterapeutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repeticoes" ADD CONSTRAINT "repeticoes_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
