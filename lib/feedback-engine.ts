/**
 * Feedback Engine — gerador de instruções de voz em PT-BR
 * Usa Web Speech API (speechSynthesis) — apenas client-side
 */

import type { Desvio, TipoDesvio } from "./pose-analysis";

const INSTRUCOES: Record<TipoDesvio, { grave: string; padrao: string }> = {
  joelho_valgo: {
    grave: "Atenção! Empurre o joelho para fora, alinhado com o segundo dedo do pé. Evite que o joelho caia para dentro.",
    padrao: "Empurre o joelho para fora, alinhado com o segundo dedo do pé.",
  },
  joelho_varo: {
    grave: "Atenção! Aproxime os joelhos, evitando que abram demais para os lados.",
    padrao: "Mantenha os joelhos alinhados, sem abrir excessivamente.",
  },
  tronco_inclinado: {
    grave: "Cuidado! Endireite o tronco, mantenha a coluna reta e olhe para frente.",
    padrao: "Endireite o tronco, olhe para frente.",
  },
  cadencia_rapida: {
    grave: "Desacelere! Faça o movimento mais devagar, especialmente na descida.",
    padrao: "Desacelere o movimento, controle a descida com calma.",
  },
  cadencia_lenta: {
    grave: "Continue o movimento! Não pare no meio da execução.",
    padrao: "Mantenha o ritmo constante do exercício.",
  },
  amplitude_insuficiente: {
    grave: "Desça mais! Flexione mais o joelho para atingir a amplitude completa do exercício.",
    padrao: "Tente flexionar um pouco mais o joelho na descida.",
  },
  assimetria_bilateral: {
    grave: "Atenção à simetria! Os dois lados do corpo devem se mover igualmente.",
    padrao: "Distribua o peso igualmente entre os dois lados.",
  },
};

// Prioridade: segurança primeiro, depois técnica
const PRIORIDADE_DESVIOS: TipoDesvio[] = [
  "joelho_valgo",      // risco de lesão ligamentar
  "joelho_varo",
  "tronco_inclinado",  // risco de lesão lombar
  "assimetria_bilateral",
  "cadencia_rapida",
  "amplitude_insuficiente",
  "cadencia_lenta",
];

let ultimaInstrucaoTs = 0;
const COOLDOWN_MS = 4000;
let vozCarregada = false;

function getVozPortugues(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices();
  return (
    vozes.find((v) => v.lang === "pt-BR") ||
    vozes.find((v) => v.lang.startsWith("pt")) ||
    vozes[0] ||
    null
  );
}

/**
 * Fala uma instrução via Web Speech API
 * Respeitando o cooldown de 4 segundos
 */
export function falarInstrucao(texto: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const agora = Date.now();
  if (agora - ultimaInstrucaoTs < COOLDOWN_MS) return;

  ultimaInstrucaoTs = agora;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "pt-BR";
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  if (vozCarregada) {
    const voz = getVozPortugues();
    if (voz) utterance.voice = voz;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Inicializa as vozes (deve ser chamado após interação do usuário)
 */
export function inicializarVoz(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  if (window.speechSynthesis.getVoices().length > 0) {
    vozCarregada = true;
    return;
  }

  window.speechSynthesis.onvoiceschanged = () => {
    vozCarregada = true;
  };
}

/**
 * Seleciona UMA instrução prioritária e a fala
 * Retorna o texto falado ou null se no cooldown
 */
export function processarDesvios(desvios: Desvio[]): string | null {
  if (desvios.length === 0) return null;

  const agora = Date.now();
  if (agora - ultimaInstrucaoTs < COOLDOWN_MS) return null;

  // Ordenar por prioridade (segurança > técnica)
  const desviosOrdenados = [...desvios].sort((a, b) => {
    const pA = PRIORIDADE_DESVIOS.indexOf(a.tipo);
    const pB = PRIORIDADE_DESVIOS.indexOf(b.tipo);
    const prioA = pA === -1 ? 99 : pA;
    const prioB = pB === -1 ? 99 : pB;

    if (prioA !== prioB) return prioA - prioB;
    // Mesma prioridade: graves primeiro
    const severidade = { grave: 0, moderada: 1, leve: 2 };
    return severidade[a.severidade] - severidade[b.severidade];
  });

  const desvio = desviosOrdenados[0];
  const instrucao = INSTRUCOES[desvio.tipo];
  if (!instrucao) return null;

  const texto =
    desvio.severidade === "grave" ? instrucao.grave : instrucao.padrao;

  falarInstrucao(texto);
  return texto;
}

/**
 * Para toda fala em andamento
 */
export function pararFeedback(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Retorna instrução de encorajamento aleatória (para uso entre séries)
 */
export function falarEncorajamento(): void {
  const frases = [
    "Ótimo trabalho! Continue assim.",
    "Excelente execução! Você está arrasando.",
    "Muito bem! Sua técnica está melhorando.",
    "Parabéns! Mais uma série concluída.",
  ];
  const frase = frases[Math.floor(Math.random() * frases.length)];
  ultimaInstrucaoTs = 0; // Reset cooldown para encorajamento
  falarInstrucao(frase);
}
