import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// dotenv v17 sobrescreve por padrão — carrega .env primeiro, .env.local por último
config({ path: ".env" });
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon: usa URL não-pooled para migrações (evita timeout no pooler do PgBouncer)
    // DATABASE_URL_UNPOOLED vem do Vercel/Neon; fallback para DATABASE_URL
    url:
      process.env["DATABASE_URL_UNPOOLED"] ||
      (process.env["DATABASE_URL"] as string),
  },
});
