import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas públicas — não requerem autenticação
const isPublicRoute = createRouteMatcher([
  "/session/(.*)",   // paciente acessando link do WhatsApp
  "/api/sessions",   // GET por token e PATCH (sem auth)
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  // Permite GET em /api/sessions com token (rota pública do paciente)
  const url = new URL(req.url);
  if (
    req.method === "GET" &&
    url.pathname === "/api/sessions" &&
    url.searchParams.has("token")
  ) {
    return;
  }

  // Permite PATCH em /api/sessions (paciente salvando dados sem login)
  if (req.method === "PATCH" && url.pathname === "/api/sessions") {
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
