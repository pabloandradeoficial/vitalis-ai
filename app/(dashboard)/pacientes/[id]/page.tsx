"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Relatorio {
  scoreMediano: number;
  scoreMinimo: number;
  scoreMaximo: number;
  adesao: number;
  totalRepeticoes: number;
  tempoTotalMs: number;
  desviosMaisFrequentes: { tipo: string; count: number }[];
}

interface Sessao {
  id: string;
  exercicio: string;
  status: string;
  scoreGeral: number | null;
  createdAt: string;
  finalizadaEm: string | null;
  relatorio: Relatorio | null;
}

interface Paciente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
}

interface Metricas {
  scoreUltimas7: number[];
  mediaGeral: number | null;
  adesaoMedia: number | null;
  alertaQueda: boolean;
  totalSessoes: number;
}

const LABELS_DESVIO: Record<string, string> = {
  joelho_valgo: "Joelho para dentro",
  joelho_varo: "Joelho para fora",
  tronco_inclinado: "Tronco inclinado",
  cadencia_rapida: "Movimento rápido",
  cadencia_lenta: "Movimento lento",
  amplitude_insuficiente: "Amplitude insuficiente",
  assimetria_bilateral: "Assimetria bilateral",
};

export default function PacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<{
    paciente: Paciente;
    sessoes: Sessao[];
    metricas: Metricas;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/reports?pacienteId=${id}`)
      .then((r) => r.json())
      .then(setDados)
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Paciente não encontrado.</p>
      </div>
    );
  }

  const { paciente, sessoes, metricas } = dados;

  const corScore = (s: number | null) => {
    if (!s) return "#6b7280";
    return s >= 75 ? "#22c55e" : s >= 50 ? "#eab308" : "#ef4444";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">
          ←
        </button>
        <div>
          <h1 className="font-bold text-lg">{paciente.nome}</h1>
          <p className="text-xs text-gray-400">
            {paciente.telefone || paciente.email || "Sem contato"}
          </p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Alerta de queda */}
        {metricas.alertaQueda && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-400">Atenção necessária</p>
              <p className="text-sm text-gray-400 mt-1">
                O score caiu mais de 15 pontos na última sessão. Pode ser necessário ajustar o protocolo.
              </p>
            </div>
          </div>
        )}

        {/* Métricas gerais */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p
              className="text-4xl font-bold"
              style={{ color: corScore(metricas.mediaGeral) }}
            >
              {metricas.mediaGeral ? Math.round(metricas.mediaGeral) : "--"}
            </p>
            <p className="text-xs text-gray-400 mt-1">Score médio (7 sessões)</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-4xl font-bold text-purple-400">
              {metricas.adesaoMedia ? `${Math.round(metricas.adesaoMedia)}%` : "--"}
            </p>
            <p className="text-xs text-gray-400 mt-1">Adesão média</p>
          </div>
        </div>

        {/* Evolução do score */}
        {metricas.scoreUltimas7.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-sm text-gray-400 mb-4">Evolução — últimas sessões</p>
            <div className="flex items-end gap-2 h-20">
              {metricas.scoreUltimas7.slice().reverse().map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t min-h-1"
                    style={{
                      height: `${(s / 100) * 64}px`,
                      background: corScore(s),
                    }}
                  />
                  <span className="text-xs text-gray-600">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de sessões */}
        <div>
          <p className="text-sm text-gray-400 mb-3">Histórico de sessões ({metricas.totalSessoes})</p>
          <div className="space-y-3">
            {sessoes.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{s.exercicio}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    {s.relatorio ? (
                      <>
                        <p
                          className="text-xl font-bold"
                          style={{ color: corScore(s.relatorio.scoreMediano) }}
                        >
                          {Math.round(s.relatorio.scoreMediano)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.relatorio.totalRepeticoes} reps
                        </p>
                      </>
                    ) : (
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          s.status === "PENDENTE"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {s.status === "PENDENTE" ? "Aguardando" : s.status.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                {s.relatorio && s.relatorio.desviosMaisFrequentes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                    {s.relatorio.desviosMaisFrequentes.slice(0, 3).map((d) => (
                      <span
                        key={d.tipo}
                        className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full"
                      >
                        {LABELS_DESVIO[d.tipo] || d.tipo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Observações */}
        {paciente.observacoes && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-sm text-gray-400 mb-2">Observações clínicas</p>
            <p className="text-sm">{paciente.observacoes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
