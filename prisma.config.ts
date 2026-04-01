import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Carrega .env.local primeiro (Vercel), fallback para .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon: usa URL não-pooled para migrações (evita timeout no pooler)
    url:
      process.env["DIRECT_URL"] ||
      process.env["DATABASE_URL_UNPOOLED"] ||
      (process.env["DATABASE_URL"] as string),
  },
});
