"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { analisarPose, LANDMARKS } from "@/lib/pose-analysis";
import { processarDesvios, inicializarVoz, falarEncorajamento } from "@/lib/feedback-engine";
import type { PoseMetrics, Landmark } from "@/lib/pose-analysis";

// MediaPipe types (carregado via CDN)
declare global {
  interface Window {
    Pose: new (config: Record<string, unknown>) => MediaPipePose;
    Camera: new (
      videoEl: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number }
    ) => { start: () => void; stop: () => void };
    drawConnectors: (
      ctx: CanvasRenderingContext2D,
      landmarks: NormalizedLandmark[],
      connections: [number, number][],
      style: { color: string; lineWidth: number }
    ) => void;
    drawLandmarks: (
      ctx: CanvasRenderingContext2D,
      landmarks: NormalizedLandmark[],
      style: { color: string; lineWidth: number; radius: number }
    ) => void;
    POSE_CONNECTIONS: [number, number][];
  }
}

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface MediaPipePose {
  setOptions: (opts: Record<string, unknown>) => void;
  onResults: (cb: (results: PoseResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface PoseResults {
  poseLandmarks?: NormalizedLandmark[];
  image: HTMLCanvasElement;
}

interface PoseTrackerProps {
  onRepeticaoCompleta: (metrics: PoseMetrics) => void;
  onScoreUpdate: (score: number) => void;
  repeticoesAlvo: number;
  exercicio: string;
}

// Conexões do skeleton
const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32],
  [11, 13], [12, 14], [13, 15], [14, 16],
];

export default function PoseTracker({
  onRepeticaoCompleta,
  onScoreUpdate,
  repeticoesAlvo,
  exercicio,
}: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<MediaPipePose | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<PoseMetrics | null>(null);
  const [repeticoes, setRepeticoes] = useState(0);
  const [ultimaInstrucao, setUltimaInstrucao] = useState<string>("");

  // Estado da cadência
  const cicloRef = useRef<{
    fase: "subindo" | "descendo";
    timestamps: number[];
    anguloMinRep: number;
    anguloMaxRep: number;
    anguloAnterior: number;
    repIniciouEm: number;
  }>({
    fase: "descendo",
    timestamps: [],
    anguloMinRep: 180,
    anguloMaxRep: 180,
    anguloAnterior: 180,
    repIniciouEm: Date.now(),
  });

  // Calcula cadência em ciclos/min baseada nos últimos timestamps
  const calcularCadencia = useCallback((): number => {
    const ts = cicloRef.current.timestamps;
    if (ts.length < 2) return 0;
    const recentes = ts.slice(-6); // últimos 6 ciclos
    const duracaoMedia =
      (recentes[recentes.length - 1] - recentes[0]) / (recentes.length - 1);
    return Math.round((60000 / duracaoMedia) * 10) / 10;
  }, []);

  // Detecta ciclos de flexão/extensão (agachamento)
  const detectarCiclo = useCallback(
    (anguloJoelho: number, metricsAtual: PoseMetrics) => {
      const ciclo = cicloRef.current;
      ciclo.anguloMinRep = Math.min(ciclo.anguloMinRep, anguloJoelho);
      ciclo.anguloMaxRep = Math.max(ciclo.anguloMaxRep, anguloJoelho);

      const delta = anguloJoelho - ciclo.anguloAnterior;
      ciclo.anguloAnterior = anguloJoelho;

      // Detecta transição: extensão → flexão (início da descida)
      if (ciclo.fase === "subindo" && delta < -2 && anguloJoelho < 160) {
        ciclo.fase = "descendo";
      }

      // Detecta transição: flexão → extensão (subindo = fim da repetição)
      if (ciclo.fase === "descendo" && delta > 2 && anguloJoelho < 130) {
        ciclo.fase = "subindo";
      }

      // Detecta conclusão da repetição: volta ao início (ângulo > 155°)
      if (ciclo.fase === "subindo" && anguloJoelho > 155 && ciclo.anguloMinRep < 130) {
        const agora = Date.now();
        const duracao = agora - ciclo.repIniciouEm;

        ciclo.timestamps.push(agora);
        if (ciclo.timestamps.length > 10) ciclo.timestamps.shift();

        onRepeticaoCompleta({
          ...metricsAtual,
          cadencia: calcularCadencia(),
        });

        setRepeticoes((r) => {
          const novas = r + 1;
          if (novas >= repeticoesAlvo) {
            falarEncorajamento();
          }
          return novas;
        });

        // Reset para próxima repetição
        ciclo.fase = "descendo";
        ciclo.anguloMinRep = 180;
        ciclo.anguloMaxRep = 180;
        ciclo.repIniciouEm = agora;
      }
    },
    [calcularCadencia, onRepeticaoCompleta, repeticoesAlvo]
  );

  // Determina cor do joint baseado no score
  const getCorJoint = (score: number): string => {
    if (score >= 75) return "#22c55e"; // verde
    if (score >= 50) return "#eab308"; // amarelo
    return "#ef4444"; // vermelho
  };

  // Callback principal de resultados do MediaPipe
  const onResults = useCallback(
    (results: PoseResults) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Limpa canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!results.poseLandmarks) return;

      const landmarks: Landmark[] = results.poseLandmarks.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      }));

      const cadencia = calcularCadencia();
      const metricsAtual = analisarPose(landmarks, cadencia);

      setMetricas(metricsAtual);
      onScoreUpdate(metricsAtual.score);

      // Detectar ciclos
      const anguloJoelho = Math.min(
        metricsAtual.anguloJoelhoEsquerdo,
        metricsAtual.anguloJoelhoDireito
      );
      detectarCiclo(anguloJoelho, metricsAtual);

      // Feedback de voz (max 1 instrução a cada 4s)
      if (metricsAtual.desvios.length > 0) {
        const instrucao = processarDesvios(metricsAtual.desvios);
        if (instrucao) setUltimaInstrucao(instrucao);
      }

      // Desenha skeleton
      const corJoint = getCorJoint(metricsAtual.score);

      // Conexões
      ctx.lineWidth = 3;
      SKELETON_CONNECTIONS.forEach(([a, b]) => {
        const lmA = results.poseLandmarks![a];
        const lmB = results.poseLandmarks![b];
        if (!lmA || !lmB) return;
        if ((lmA.visibility ?? 0) < 0.5 || (lmB.visibility ?? 0) < 0.5) return;

        ctx.beginPath();
        ctx.moveTo(lmA.x * canvas.width, lmA.y * canvas.height);
        ctx.lineTo(lmB.x * canvas.width, lmB.y * canvas.height);
        ctx.strokeStyle = corJoint;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
      });

      // Joints
      results.poseLandmarks.forEach((lm, i) => {
        if ((lm.visibility ?? 0) < 0.5) return;
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;

        // Destaca joints importantes
        const importantes = [
          LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
          LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
          LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE,
        ];
        const raio = importantes.includes(i) ? 8 : 5;

        ctx.beginPath();
        ctx.arc(x, y, raio, 0, 2 * Math.PI);
        ctx.fillStyle = corJoint;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      ctx.globalAlpha = 1;

      // Ângulos no canvas
      const joelhoEsq = results.poseLandmarks[LANDMARKS.LEFT_KNEE];
      if (joelhoEsq && (joelhoEsq.visibility ?? 0) > 0.5) {
        const x = joelhoEsq.x * canvas.width + 15;
        const y = joelhoEsq.y * canvas.height;
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        const texto = `${Math.round(metricsAtual.anguloJoelhoEsquerdo)}°`;
        ctx.strokeText(texto, x, y);
        ctx.fillText(texto, x, y);
      }
    },
    [calcularCadencia, detectarCiclo, onScoreUpdate]
  );

  // Carrega MediaPipe via CDN e inicializa câmera
  useEffect(() => {
    let pose: MediaPipePose | null = null;

    const carregarMediaPipe = async () => {
      // Aguarda scripts carregarem
      await new Promise<void>((resolve) => {
        if (window.Pose) { resolve(); return; }
        const check = setInterval(() => {
          if (window.Pose) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 10000);
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        pose = new window.Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(onResults);
        poseRef.current = pose;

        // Loop de detecção
        const detect = async () => {
          if (videoRef.current && poseRef.current && videoRef.current.readyState >= 2) {
            await poseRef.current.send({ image: videoRef.current });
          }
          animFrameRef.current = requestAnimationFrame(detect);
        };

        animFrameRef.current = requestAnimationFrame(detect);
        setCarregando(false);
        inicializarVoz();
      } catch (err) {
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Permissão de câmera negada. Permita o acesso nas configurações do navegador."
            : "Não foi possível acessar a câmera. Verifique se outro app está usando.";
        setErroCamera(msg);
        setCarregando(false);
      }
    };

    carregarMediaPipe();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (poseRef.current) poseRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onResults]);

  if (erroCamera) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-6 rounded-2xl">
        <div className="text-5xl mb-4">📷</div>
        <p className="text-center text-red-400 font-medium">{erroCamera}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      {/* Vídeo da câmera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Canvas do skeleton (espelhado igual ao vídeo) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Loading overlay */}
      {carregando && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Carregando análise de movimento...</p>
        </div>
      )}

      {/* HUD superior — score e exercício */}
      {!carregando && (
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">
            <p className="text-xs text-gray-300 font-medium">{exercicio}</p>
          </div>
          {metricas && (
            <div
              className="rounded-xl px-3 py-2 bg-black/60 backdrop-blur-sm"
              style={{
                borderLeft: `4px solid ${
                  metricas.score >= 75
                    ? "#22c55e"
                    : metricas.score >= 50
                    ? "#eab308"
                    : "#ef4444"
                }`,
              }}
            >
              <p className="text-xs text-gray-300">Score</p>
              <p
                className="text-2xl font-bold"
                style={{
                  color:
                    metricas.score >= 75
                      ? "#22c55e"
                      : metricas.score >= 50
                      ? "#eab308"
                      : "#ef4444",
                }}
              >
                {metricas.score}
              </p>
            </div>
          )}
        </div>
      )}

      {/* HUD inferior — métricas */}
      {metricas && !carregando && (
        <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-xl p-3 pointer-events-none">
          <div className="grid grid-cols-3 gap-2 text-center text-white text-xs">
            <div>
              <p className="text-gray-400">Joelho E</p>
              <p className="font-bold text-base">
                {Math.round(metricas.anguloJoelhoEsquerdo)}°
              </p>
            </div>
            <div>
              <p className="text-gray-400">Tronco</p>
              <p className="font-bold text-base">
                {Math.round(metricas.anguloTronco)}°
              </p>
            </div>
            <div>
              <p className="text-gray-400">Simetria</p>
              <p className="font-bold text-base">
                {Math.round(metricas.simetriaBilateral)}%
              </p>
            </div>
          </div>

          {ultimaInstrucao && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-yellow-300 text-xs text-center">
                🎙️ {ultimaInstrucao}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
