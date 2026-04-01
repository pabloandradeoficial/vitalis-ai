"use client";

import type { Desvio } from "@/lib/pose-analysis";

interface FeedbackOverlayProps {
  score: number;
  desvios: Desvio[];
  repeticoes: number;
  repeticoesAlvo: number;
  concluido?: boolean;
}

const CORES_DESVIO = {
  grave: { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400" },
  moderada: { bg: "bg-yellow-500/20", border: "border-yellow-500", text: "text-yellow-400" },
  leve: { bg: "bg-blue-500/20", border: "border-blue-500", text: "text-blue-400" },
};

const LABELS_DESVIO: Record<string, string> = {
  joelho_valgo: "Joelho para dentro",
  joelho_varo: "Joelho para fora",
  tronco_inclinado: "Tronco inclinado",
  cadencia_rapida: "Movimento rápido",
  cadencia_lenta: "Movimento lento",
  amplitude_insuficiente: "Amplitude insuficiente",
  assimetria_bilateral: "Assimetria bilateral",
};

export default function FeedbackOverlay({
  score,
  desvios,
  repeticoes,
  repeticoesAlvo,
  concluido = false,
}: FeedbackOverlayProps) {
  const progresso = Math.min((repeticoes / repeticoesAlvo) * 100, 100);

  const corScore =
    score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";

  const bgScore =
    score >= 75 ? "from-green-500/20" : score >= 50 ? "from-yellow-500/20" : "from-red-500/20";

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <div className={`bg-gradient-to-br ${bgScore} to-transparent rounded-2xl p-4 border border-white/10`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Score de execução</p>
            <p className={`text-5xl font-bold ${corScore}`}>{score}</p>
            <p className="text-xs text-gray-500 mt-1">
              {score >= 75 ? "Excelente!" : score >= 50 ? "Boa execução" : "Precisa melhorar"}
            </p>
          </div>
          <div className="text-center">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${score} ${100 - score}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${corScore}`}>
                {score}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progresso de repetições */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-gray-400">Repetições</p>
          <p className="text-sm font-bold text-white">
            {repeticoes} / {repeticoesAlvo}
          </p>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progresso}%`,
              background: concluido
                ? "#22c55e"
                : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
            }}
          />
        </div>
        {concluido && (
          <p className="text-green-400 text-xs mt-2 text-center font-medium">
            ✅ Série concluída!
          </p>
        )}
      </div>

      {/* Desvios detectados */}
      {desvios.length > 0 && (
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <p className="text-sm text-gray-400 mb-3">Correções</p>
          <div className="space-y-2">
            {desvios.slice(0, 3).map((d, i) => {
              const cores = CORES_DESVIO[d.severidade];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cores.bg} ${cores.border}`}
                >
                  <span className="text-lg">
                    {d.severidade === "grave" ? "🔴" : d.severidade === "moderada" ? "🟡" : "🔵"}
                  </span>
                  <div>
                    <p className={`text-xs font-medium ${cores.text}`}>
                      {LABELS_DESVIO[d.tipo] || d.tipo}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{d.severidade}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sem desvios = tudo certo */}
      {desvios.length === 0 && score > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-green-400 text-sm font-medium">Execução perfeita!</p>
        </div>
      )}
    </div>
  );
}
