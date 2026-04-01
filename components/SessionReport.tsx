"use client";

import type { PoseMetrics } from "@/lib/pose-analysis";

interface SessionReportProps {
  exercicio: string;
  repeticoes: PoseMetrics[];
  tempoTotalMs: number;
  onNovasSessao: () => void;
}

function calcularMedia(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function SessionReport({
  exercicio,
  repeticoes,
  tempoTotalMs,
  onNovasSessao,
}: SessionReportProps) {
  if (!repeticoes.length) {
    return (
      <div className="text-center text-gray-400 p-8">
        <p>Nenhuma repetição registrada.</p>
      </div>
    );
  }

  const scores = repeticoes.map((r) => r.score);
  const scoreMedia = calcularMedia(scores);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);

  const minutos = Math.floor(tempoTotalMs / 60000);
  const segundos = Math.floor((tempoTotalMs % 60000) / 1000);

  // Desvios mais frequentes
  const contagemDesvios: Record<string, number> = {};
  repeticoes.forEach((r) => {
    r.desvios.forEach((d) => {
      contagemDesvios[d.tipo] = (contagemDesvios[d.tipo] || 0) + 1;
    });
  });
  const desviosOrdenados = Object.entries(contagemDesvios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const LABELS_DESVIO: Record<string, string> = {
    joelho_valgo: "Joelho para dentro",
    joelho_varo: "Joelho para fora",
    tronco_inclinado: "Tronco inclinado",
    cadencia_rapida: "Movimento rápido demais",
    cadencia_lenta: "Movimento lento demais",
    amplitude_insuficiente: "Amplitude insuficiente",
    assimetria_bilateral: "Assimetria bilateral",
  };

  const corScore =
    scoreMedia >= 75 ? "#22c55e" : scoreMedia >= 50 ? "#eab308" : "#ef4444";

  const medalha =
    scoreMedia >= 85 ? "🥇" : scoreMedia >= 70 ? "🥈" : scoreMedia >= 50 ? "🥉" : "💪";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-5xl mb-3">{medalha}</p>
        <h1 className="text-2xl font-bold">Sessão Concluída!</h1>
        <p className="text-gray-400 mt-1">{exercicio}</p>
      </div>

      {/* Score principal */}
      <div
        className="rounded-2xl p-6 mb-6 text-center"
        style={{ background: `${corScore}15`, border: `1px solid ${corScore}40` }}
      >
        <p className="text-gray-400 text-sm mb-1">Score médio</p>
        <p className="text-7xl font-bold" style={{ color: corScore }}>
          {scoreMedia}
        </p>
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Mínimo</p>
            <p className="font-semibold text-red-400">{scoreMin}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Máximo</p>
            <p className="font-semibold text-green-400">{scoreMax}</p>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <p className="text-3xl font-bold text-blue-400">{repeticoes.length}</p>
          <p className="text-xs text-gray-400 mt-1">Repetições</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <p className="text-3xl font-bold text-purple-400">
            {minutos}:{segundos.toString().padStart(2, "0")}
          </p>
          <p className="text-xs text-gray-400 mt-1">Duração</p>
        </div>
      </div>

      {/* Evolução por repetição */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
        <p className="text-sm text-gray-400 mb-3">Evolução por repetição</p>
        <div className="flex items-end gap-1 h-16">
          {scores.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(s / 100) * 52}px`,
                  background:
                    s >= 75 ? "#22c55e" : s >= 50 ? "#eab308" : "#ef4444",
                  minHeight: "4px",
                }}
              />
              <span className="text-xs text-gray-600">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desvios mais frequentes */}
      {desviosOrdenados.length > 0 && (
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
          <p className="text-sm text-gray-400 mb-3">Pontos a melhorar</p>
          <div className="space-y-2">
            {desviosOrdenados.map(([tipo, count]) => (
              <div key={tipo} className="flex items-center justify-between">
                <p className="text-sm text-gray-300">
                  {LABELS_DESVIO[tipo] || tipo}
                </p>
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                  {count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto space-y-3">
        <p className="text-center text-xs text-gray-500">
          Relatório enviado ao seu fisioterapeuta ✓
        </p>
        <button
          onClick={onNovasSessao}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-semibold text-lg transition-colors"
        >
          Nova sessão
        </button>
      </div>
    </div>
  );
}
