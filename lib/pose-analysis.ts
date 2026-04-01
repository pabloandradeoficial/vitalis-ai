/**
 * Pose Analysis — lógica de métricas cinéticas
 * Todos os cálculos são client-side apenas (sem SSR)
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseMetrics {
  anguloJoelhoEsquerdo: number;
  anguloJoelhoDireito: number;
  anguloTronco: number;
  simetriaBilateral: number; // 0-100 (100 = perfeito)
  cadencia: number;          // ciclos/minuto
  desvios: Desvio[];
  score: number;             // 0-100
}

export type TipoDesvio =
  | "joelho_valgo"
  | "joelho_varo"
  | "tronco_inclinado"
  | "cadencia_rapida"
  | "cadencia_lenta"
  | "amplitude_insuficiente"
  | "assimetria_bilateral";

export interface Desvio {
  tipo: TipoDesvio;
  severidade: "leve" | "moderada" | "grave";
  valor: number;
}

// Índices dos landmarks do MediaPipe Pose
export const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Calcula o ângulo entre três pontos em graus (ponto B é o vértice)
 */
export function calcularAngulo(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angulo = Math.abs((radians * 180.0) / Math.PI);
  if (angulo > 180) angulo = 360 - angulo;
  return angulo;
}

/**
 * Calcula ângulo do joelho esquerdo: LEFT_HIP → LEFT_KNEE → LEFT_ANKLE
 */
export function calcularAnguloJoelhoEsquerdo(landmarks: Landmark[]): number {
  const hip = landmarks[LANDMARKS.LEFT_HIP];
  const knee = landmarks[LANDMARKS.LEFT_KNEE];
  const ankle = landmarks[LANDMARKS.LEFT_ANKLE];
  if (!hip || !knee || !ankle) return 180;
  return calcularAngulo(hip, knee, ankle);
}

/**
 * Calcula ângulo do joelho direito: RIGHT_HIP → RIGHT_KNEE → RIGHT_ANKLE
 */
export function calcularAnguloJoelhoDireito(landmarks: Landmark[]): number {
  const hip = landmarks[LANDMARKS.RIGHT_HIP];
  const knee = landmarks[LANDMARKS.RIGHT_KNEE];
  const ankle = landmarks[LANDMARKS.RIGHT_ANKLE];
  if (!hip || !knee || !ankle) return 180;
  return calcularAngulo(hip, knee, ankle);
}

/**
 * Calcula ângulo do tronco: LEFT_SHOULDER → LEFT_HIP → LEFT_KNEE
 */
export function calcularAnguloTronco(landmarks: Landmark[]): number {
  const shoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
  const hip = landmarks[LANDMARKS.LEFT_HIP];
  const knee = landmarks[LANDMARKS.LEFT_KNEE];
  if (!shoulder || !hip || !knee) return 180;
  return calcularAngulo(shoulder, hip, knee);
}

/**
 * Calcula simetria bilateral (0-100)
 * Compara posição relativa dos joelhos esquerd/direito em relação aos quadris
 */
export function calcularSimetria(landmarks: Landmark[]): number {
  const leftHip = landmarks[LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[LANDMARKS.RIGHT_HIP];
  const leftKnee = landmarks[LANDMARKS.LEFT_KNEE];
  const rightKnee = landmarks[LANDMARKS.RIGHT_KNEE];

  if (!leftHip || !rightHip || !leftKnee || !rightKnee) return 100;

  const leftDeviation = Math.abs(leftKnee.x - leftHip.x);
  const rightDeviation = Math.abs(rightKnee.x - rightHip.x);

  const diff = Math.abs(leftDeviation - rightDeviation);
  const maxDev = Math.max(leftDeviation, rightDeviation, 0.001);
  const assimetria = (diff / maxDev) * 100;

  return Math.max(0, 100 - assimetria);
}

/**
 * Detecta desvios com base nas métricas calculadas
 */
export function detectarDesvios(
  landmarks: Landmark[],
  anguloJoelhoEsq: number,
  anguloJoelhoDireito: number,
  anguloTronco: number,
  simetria: number,
  cadencia: number
): Desvio[] {
  const desvios: Desvio[] = [];

  // Joelho valgo (joelho para dentro) — detectado pela posição X do joelho vs quadril
  const leftHip = landmarks[LANDMARKS.LEFT_HIP];
  const leftKnee = landmarks[LANDMARKS.LEFT_KNEE];
  const leftAnkle = landmarks[LANDMARKS.LEFT_ANKLE];

  if (leftHip && leftKnee && leftAnkle) {
    const kneeMedialDeviation = leftKnee.x - leftHip.x;
    if (kneeMedialDeviation > 0.05) {
      desvios.push({
        tipo: "joelho_valgo",
        severidade: kneeMedialDeviation > 0.12 ? "grave" : kneeMedialDeviation > 0.08 ? "moderada" : "leve",
        valor: kneeMedialDeviation,
      });
    }
    if (kneeMedialDeviation < -0.08) {
      desvios.push({
        tipo: "joelho_varo",
        severidade: kneeMedialDeviation < -0.15 ? "grave" : "leve",
        valor: Math.abs(kneeMedialDeviation),
      });
    }
  }

  // Tronco inclinado
  if (anguloTronco < 150) {
    desvios.push({
      tipo: "tronco_inclinado",
      severidade: anguloTronco < 120 ? "grave" : anguloTronco < 135 ? "moderada" : "leve",
      valor: 180 - anguloTronco,
    });
  }

  // Cadência
  if (cadencia > 35) {
    desvios.push({
      tipo: "cadencia_rapida",
      severidade: cadencia > 50 ? "grave" : "leve",
      valor: cadencia,
    });
  }
  if (cadencia > 0 && cadencia < 10) {
    desvios.push({
      tipo: "cadencia_lenta",
      severidade: "leve",
      valor: cadencia,
    });
  }

  // Amplitude insuficiente (agachamento — joelho deve flexionar pelo menos 70°)
  const minAnguloJoelho = Math.min(anguloJoelhoEsq, anguloJoelhoDireito);
  if (minAnguloJoelho > 110) {
    desvios.push({
      tipo: "amplitude_insuficiente",
      severidade: minAnguloJoelho > 140 ? "grave" : "leve",
      valor: minAnguloJoelho,
    });
  }

  // Assimetria bilateral
  if (simetria < 70) {
    desvios.push({
      tipo: "assimetria_bilateral",
      severidade: simetria < 50 ? "grave" : "leve",
      valor: 100 - simetria,
    });
  }

  return desvios;
}

/**
 * Calcula score de execução 0-100
 * 40% amplitude correta + 30% sem compensação + 30% cadência adequada
 */
export function calcularScore(
  anguloJoelhoMin: number,
  desvios: Desvio[],
  cadencia: number
): number {
  // 40% — amplitude correta (joelho flexionando entre 70° e 110°)
  const amplitudeIdeal = anguloJoelhoMin >= 70 && anguloJoelhoMin <= 110;
  const amplitudePartial =
    anguloJoelhoMin < 70
      ? Math.max(0, 100 - (70 - anguloJoelhoMin) * 2)
      : anguloJoelhoMin <= 140
      ? Math.max(0, 100 - (anguloJoelhoMin - 110) * 2)
      : 0;
  const scoreAmplitude = amplitudeIdeal ? 100 : amplitudePartial;

  // 30% — sem compensações (penaliza por desvios graves)
  const pesoDesvio = desvios.reduce((acc, d) => {
    return acc + (d.severidade === "grave" ? 40 : d.severidade === "moderada" ? 20 : 8);
  }, 0);
  const scoreCompensacao = Math.max(0, 100 - pesoDesvio);

  // 30% — cadência (ideal: 15-25 ciclos/min)
  const cadenciaIdeal = cadencia >= 15 && cadencia <= 25;
  const scoreCadencia = cadenciaIdeal
    ? 100
    : cadencia === 0
    ? 50
    : cadencia < 15
    ? Math.max(0, 100 - (15 - cadencia) * 3)
    : Math.max(0, 100 - (cadencia - 25) * 3);

  return Math.round(
    scoreAmplitude * 0.4 + scoreCompensacao * 0.3 + scoreCadencia * 0.3
  );
}

/**
 * Analisa todos os landmarks e retorna métricas completas
 */
export function analisarPose(
  landmarks: Landmark[],
  cadencia: number
): PoseMetrics {
  const anguloJoelhoEsq = calcularAnguloJoelhoEsquerdo(landmarks);
  const anguloJoelhoDir = calcularAnguloJoelhoDireito(landmarks);
  const anguloTronco = calcularAnguloTronco(landmarks);
  const simetria = calcularSimetria(landmarks);

  const desvios = detectarDesvios(
    landmarks,
    anguloJoelhoEsq,
    anguloJoelhoDir,
    anguloTronco,
    simetria,
    cadencia
  );

  const minJoelho = Math.min(anguloJoelhoEsq, anguloJoelhoDir);
  const score = calcularScore(minJoelho, desvios, cadencia);

  return {
    anguloJoelhoEsquerdo: anguloJoelhoEsq,
    anguloJoelhoDireito: anguloJoelhoDir,
    anguloTronco,
    simetriaBilateral: simetria,
    cadencia,
    desvios,
    score,
  };
}
