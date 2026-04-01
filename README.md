# Vitalis AI 🏋️‍♂️

Plataforma de visão computacional para fisioterapia que rastreia exercícios domiciliares via câmera do celular, sem download de app.

## Stack
- **Next.js 14** (App Router) + TypeScript
- **MediaPipe Pose** (via CDN — client-side only)
- **PostgreSQL** + Prisma ORM
- **Clerk** — autenticação de fisioterapeutas
- **Vercel** — deploy + Postgres

---

## Setup em 5 passos

### 1. Clonar e instalar dependências
```bash
git clone <repo>
cd vitalis-ai
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```
Edite `.env.local` com suas credenciais:
- **DATABASE_URL** — string de conexão do seu PostgreSQL (Vercel Postgres, Neon, Supabase...)
- **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** e **CLERK_SECRET_KEY** — crie um projeto em [clerk.com](https://clerk.com)

### 3. Criar o banco de dados
```bash
npx prisma migrate dev --name init
```

### 4. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000)

### 5. Deploy na Vercel
```bash
npx vercel --prod
```
Ou conecte o repositório GitHub na dashboard da Vercel e adicione as variáveis de ambiente.

---

## Como funciona

### Fluxo do fisioterapeuta
1. Faz login em `/dashboard`
2. Seleciona um paciente e um exercício
3. Clica em "Gerar link" → URL única é criada
4. Clica "Copiar para WhatsApp" → mensagem pronta para enviar
5. Acompanha progresso em tempo real no dashboard

### Fluxo do paciente
1. Recebe link pelo WhatsApp (ex: `vitalis.app/session/abc123`)
2. Abre no celular — **sem download de app**
3. Clica "Iniciar Exercício" → câmera é ativada
4. Faz o exercício com feedback de voz em PT-BR
5. Score e repetições aparecem na tela em tempo real
6. Ao finalizar, relatório é enviado ao fisio automaticamente

### Privacidade
- **Nenhum vídeo é enviado ao servidor**
- Apenas landmarks JSON (33 pontos do corpo) são processados localmente
- O processamento de visão computacional acontece 100% no dispositivo

---

## Estrutura do projeto

```
vitalis-ai/
├── app/
│   ├── (auth)/          # Sign-in e Sign-up (Clerk)
│   ├── (dashboard)/     # Dashboard do fisioterapeuta
│   ├── session/[token]/ # Página do paciente (link público)
│   └── api/             # Routes: sessions, reports
├── components/
│   ├── PoseTracker.tsx  # MediaPipe + câmera + skeleton
│   ├── FeedbackOverlay  # HUD de métricas
│   └── SessionReport    # Tela de resultados
├── lib/
│   ├── pose-analysis.ts    # Cálculo de ângulos, score, desvios
│   ├── feedback-engine.ts  # Instruções de voz (Web Speech API)
│   └── prisma.ts
└── prisma/schema.prisma
```

## Métricas calculadas em tempo real

| Métrica | Descrição |
|---------|-----------|
| **Ângulo do joelho** | LEFT_HIP → LEFT_KNEE → LEFT_ANKLE |
| **Ângulo do tronco** | LEFT_SHOULDER → LEFT_HIP → LEFT_KNEE |
| **Simetria bilateral** | Comparação esquerdo vs direito |
| **Cadência** | Ciclos de flexão/extensão por minuto |
| **Score de execução** | 40% amplitude + 30% sem compensação + 30% cadência |

## Desvios detectados

- `joelho_valgo` — joelho caindo para dentro
- `joelho_varo` — joelho abrindo para fora
- `tronco_inclinado` — flexão anterior do tronco
- `cadencia_rapida` / `cadencia_lenta`
- `amplitude_insuficiente` — flexão insuficiente
- `assimetria_bilateral` — diferença esquerdo/direito
