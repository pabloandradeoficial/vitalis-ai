"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import SessionReport from "@/components/SessionReport";
import FeedbackOverlay from "@/components/FeedbackOverlay";
import type { PoseMetrics } from "@/lib/pose-analysis";

// PoseTracker carregado apenas no client (MediaPipe não roda no servidor)
const PoseTracker = dynamic(() => import("@/components/PoseTracker"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-900 rounded-2xl">
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface SessaoData {
  id: string;
  exercicio: string;
  descricao: string | null;
  repeticoesAlvo: number;
  paciente: { nome: string };
  status: string;
}

type Fase = "inicio" | "exercitando" | "concluido";

export default function SessionPage() {
  const { token } = useParams<{ token: string }>();

  const [sessao, setSessao] = useState<SessaoData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fase, setFase] = useState<Fase>("inicio");
  const [scoreAtual, setScoreAtual] = useState(0);
  const [repeticoes, setRepeticoes] = useState<PoseMetrics[]>([]);
  const [desviosAtuais, setDesviosAtuais] = useState<PoseMetrics["desvios"]>([]);
  const inicioRef = useRef<number>(0);
  const [concluido, setConcluido] = useState(false);

  // Busca dados da sessão
  useEffect(() => {
    if (!token) return;

    fetch(`/api/sessions?token=${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Sessão não encontrada ou expirada.");
        return r.json();
      })
      .then((data) => setSessao(data))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [token]);

  const handleRepeticaoCompleta = useCallback((metrics: PoseMetrics) => {
    setRepeticoes((prev) => {
      const novas = [...prev, metrics];

      if (sessao && novas.length >= sessao.repeticoesAlvo) {
        setConcluido(true);
      }

      return novas;
    });
    setDesviosAtuais(metrics.desvios);
  }, [sessao]);

  const handleScoreUpdate = useCallback((score: number) => {
    setScoreAtual(score);
  }, []);

  const iniciarExercicio = () => {
    inicioRef.current = Date.now();
    setFase("exercitando");
  };

  const finalizarSessao = useCallback(async () => {
    if (!sessao || repeticoes.length === 0) {
      setFase("concluido");
      return;
    }

    const tempoTotal = Date.now() - inicioRef.current;

    try {
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          repeticoes: repeticoes.map((r, i) => ({
            numero: i + 1,
            scoreExecucao: r.score,
            desviosDetectados: r.desvios,
            duracaoMs: Math.round(tempoTotal / repeticoes.length),
            anguloJoelhoMin: Math.min(r.anguloJoelhoEsquerdo, r.anguloJoelhoDireito),
            anguloJoelhoMax: Math.max(r.anguloJoelhoEsquerdo, r.anguloJoelhoDireito),
            anguloTronco: r.anguloTronco,
            simetria: r.simetriaBilateral,
          })),
          tempoTotalMs: tempoTotal,
        }),
      });
    } catch {
      // Falha silenciosa — o paciente já fez o exercício
      console.error("Erro ao salvar sessão");
    }

    setFase("concluido");
  }, [sessao, repeticoes, token]);

  // Auto-finaliza quando atingir repetições alvo
  useEffect(() => {
    if (concluido && fase === "exercitando") {
      const timer = setTimeout(finalizarSessao, 2000);
      return () => clearTimeout(timer);
    }
  }, [concluido, fase, finalizarSessao]);

  // --- ESTADOS DE LOADING / ERRO ---
  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando exercício...</p>
        </div>
      </div>
    );
  }

  if (erro || !sessao) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <p className="text-5xl mb-4">😕</p>
          <h1 className="text-xl font-bold mb-2">Link inválido</h1>
          <p className="text-gray-400">{erro || "Sessão não encontrada."}</p>
        </div>
      </div>
    );
  }

  // --- TELA DE RELATÓRIO FINAL ---
  if (fase === "concluido") {
    const tempoTotal = Date.now() - inicioRef.current;
    return (
      <SessionReport
        exercicio={sessao.exercicio}
        repeticoes={repeticoes}
        tempoTotalMs={tempoTotal}
        onNovasSessao={() => {
          setFase("inicio");
          setRepeticoes([]);
          setScoreAtual(0);
          setConcluido(false);
        }}
      />
    );
  }

  // --- TELA INICIAL ---
  if (fase === "inicio") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">🏋️</span>
          </div>

          <p className="text-sm text-blue-400 font-medium mb-2">
            Olá, {sessao.paciente.nome}!
          </p>
          <h1 className="text-3xl font-bold mb-3">{sessao.exercicio}</h1>

          {sessao.descricao && (
            <p className="text-gray-400 text-sm max-w-sm mb-4">
              {sessao.descricao}
            </p>
          )}

          <div className="bg-white/5 rounded-xl p-4 mb-8 border border-white/10 w-full max-w-xs">
            <p className="text-xs text-gray-500 mb-1">Meta da sessão</p>
            <p className="text-2xl font-bold text-blue-400">
              {sessao.repeticoesAlvo} repetições
            </p>
          </div>

          <div className="text-xs text-gray-500 space-y-1 mb-8 max-w-xs">
            <p>📷 Você vai usar a câmera frontal do celular</p>
            <p>🎙️ O app vai dar instruções em voz</p>
            <p>📊 Nenhum vídeo é enviado ao servidor</p>
          </div>
        </div>

        <button
          onClick={iniciarExercicio}
          className="w-full py-5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-2xl font-bold text-xl transition-all"
        >
          Iniciar Exercício
        </button>
      </div>
    );
  }

  // --- TELA DE EXERCÍCIO ---
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Câmera + skeleton (2/3 da tela) */}
      <div className="flex-1 relative" style={{ minHeight: "55vh" }}>
        <PoseTracker
          onRepeticaoCompleta={handleRepeticaoCompleta}
          onScoreUpdate={handleScoreUpdate}
          repeticoesAlvo={sessao.repeticoesAlvo}
          exercicio={sessao.exercicio}
        />
      </div>

      {/* Painel de feedback (1/3 inferior) */}
      <div className="p-4 bg-gray-950 space-y-3" style={{ maxHeight: "45vh", overflowY: "auto" }}>
        <FeedbackOverlay
          score={scoreAtual}
          desvios={desviosAtuais}
          repeticoes={repeticoes.length}
          repeticoesAlvo={sessao.repeticoesAlvo}
          concluido={concluido}
        />

        <button
          onClick={finalizarSessao}
          className="w-full py-3 border border-white/20 hover:bg-white/10 rounded-xl text-sm text-gray-400 transition"
        >
          Encerrar sessão
        </button>
      </div>
    </div>
  );
}
