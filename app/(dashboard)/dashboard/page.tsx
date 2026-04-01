"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

interface Sessao {
  id: string;
  exercicio: string;
  status: string;
  scoreGeral: number | null;
  createdAt: string;
  relatorio: {
    scoreMediano: number;
    adesao: number;
  } | null;
}

interface Paciente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  sessoes: Sessao[];
}

interface MetricasPaciente {
  scoreUltimas7: number[];
  mediaGeral: number | null;
  adesaoMedia: number | null;
  alertaQueda: boolean;
}

interface PacienteComMetricas extends Paciente {
  metricas?: MetricasPaciente;
}

interface NovoLinkForm {
  pacienteId: string;
  exercicio: string;
  descricao: string;
  repeticoesAlvo: number;
}

interface NovoPacienteForm {
  nome: string;
  telefone: string;
  email: string;
}

const EXERCICIOS_COMUNS = [
  "Agachamento",
  "Extensão de joelho",
  "Abdução de quadril",
  "Ponte glútea",
  "Elevação de panturrilha",
  "Step up",
  "Afundo",
  "Mini-agachamento",
];

export default function DashboardPage() {
  const { user } = useUser();
  const [pacientes, setPacientes] = useState<PacienteComMetricas[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modal: novo exercício (link)
  const [mostrarModalLink, setMostrarModalLink] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Modal: novo paciente
  const [mostrarModalPaciente, setMostrarModalPaciente] = useState(false);
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [erroPaciente, setErroPaciente] = useState<string | null>(null);
  const [novoPaciente, setNovoPaciente] = useState<NovoPacienteForm>({
    nome: "",
    telefone: "",
    email: "",
  });

  const [form, setForm] = useState<NovoLinkForm>({
    pacienteId: "",
    exercicio: "",
    descricao: "",
    repeticoesAlvo: 10,
  });

  const carregarPacientes = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Erro ao carregar");
      const data = await res.json();
      setPacientes(data);
    } catch {
      console.error("Erro ao carregar pacientes");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPacientes();
  }, [carregarPacientes]);

  const salvarPaciente = async () => {
    if (!novoPaciente.nome.trim()) {
      setErroPaciente("Nome é obrigatório.");
      return;
    }
    setSalvandoPaciente(true);
    setErroPaciente(null);

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoPaciente),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar paciente");
      }
      await carregarPacientes();
      setMostrarModalPaciente(false);
      setNovoPaciente({ nome: "", telefone: "", email: "" });
    } catch (e) {
      setErroPaciente(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSalvandoPaciente(false);
    }
  };

  const gerarLink = async () => {
    if (!form.pacienteId || !form.exercicio) return;
    setGerandoLink(true);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setLinkGerado(data.link);
      await carregarPacientes();
    } catch {
      alert("Erro ao gerar link. Tente novamente.");
    } finally {
      setGerandoLink(false);
    }
  };

  const copiarParaWhatsApp = (link: string, nomePaciente: string, exercicio: string) => {
    const msg = `Olá ${nomePaciente}! 👋\n\nSeu exercício de hoje está pronto:\n*${exercicio}*\n\nAcesse pelo link abaixo (sem precisar baixar app):\n${link}\n\nQualquer dúvida, me chame aqui! 💪`;
    navigator.clipboard.writeText(msg);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-gray-500";
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const ultimaSessaoConcluida = (sessoes: Sessao[]) =>
    sessoes.find((s) => s.status === "CONCLUIDA" && s.relatorio);

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Vitalis AI</h1>
          <p className="text-xs text-gray-400">Olá, {user?.firstName}!</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMostrarModalPaciente(true); setErroPaciente(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium transition"
          >
            + Paciente
          </button>
          <button
            onClick={() => { setMostrarModalLink(true); setLinkGerado(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium transition"
          >
            + Exercício
          </button>
        </div>
      </header>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3 p-6 pb-0">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{pacientes.length}</p>
          <p className="text-xs text-gray-400">Pacientes</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">
            {pacientes.reduce((acc, p) => acc + p.sessoes.filter((s) => s.status === "CONCLUIDA").length, 0)}
          </p>
          <p className="text-xs text-gray-400">Sessões concluídas</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {pacientes.filter((p) => {
              const ul = ultimaSessaoConcluida(p.sessoes);
              return ul?.relatorio && ul.relatorio.scoreMediano < 60;
            }).length}
          </p>
          <p className="text-xs text-gray-400">Precisam atenção</p>
        </div>
      </div>

      {/* Lista de pacientes */}
      <main className="p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-400">Meus pacientes</h2>

        {pacientes.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-4">🏥</p>
            <p>Nenhum paciente ainda.</p>
            <button
              onClick={() => { setMostrarModalPaciente(true); setErroPaciente(null); }}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Adicionar primeiro paciente
            </button>
          </div>
        )}

        {pacientes.map((paciente) => {
          const ultimaSessao = ultimaSessaoConcluida(paciente.sessoes);
          const scoreRecente = ultimaSessao?.relatorio?.scoreMediano ?? null;
          const adesao = ultimaSessao?.relatorio?.adesao ?? null;

          const sessoesConc = paciente.sessoes.filter(
            (s) => s.status === "CONCLUIDA" && s.relatorio
          );
          const alertaQueda =
            sessoesConc.length >= 2 &&
            (sessoesConc[0].relatorio!.scoreMediano - sessoesConc[1].relatorio!.scoreMediano) < -15;

          return (
            <div
              key={paciente.id}
              className={`bg-white/5 border rounded-2xl p-4 ${
                alertaQueda ? "border-red-500/50" : "border-white/10"
              }`}
            >
              {alertaQueda && (
                <div className="flex items-center gap-2 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <span>⚠️</span>
                  <p className="text-xs text-red-400">Score caiu mais de 15 pontos</p>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{paciente.nome}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {paciente.telefone || paciente.email || "Sem contato"}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${getScoreColor(scoreRecente)}`}>
                    {scoreRecente !== null ? Math.round(scoreRecente) : "--"}
                  </p>
                  <p className="text-xs text-gray-500">último score</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
                <span>📊 Adesão: {adesao !== null ? `${Math.round(adesao)}%` : "—"}</span>
                <span>🏋️ {paciente.sessoes.filter((s) => s.status === "CONCLUIDA").length} sessões</span>
              </div>

              {paciente.sessoes.filter((s) => s.status === "PENDENTE").length > 0 && (
                <div className="mt-3 space-y-2">
                  {paciente.sessoes
                    .filter((s) => s.status === "PENDENTE")
                    .slice(0, 2)
                    .map((s) => {
                      const link = `${window.location.origin}/session/${s.id}`;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-medium">{s.exercicio}</p>
                            <p className="text-xs text-gray-500">Aguardando</p>
                          </div>
                          <button
                            onClick={() => copiarParaWhatsApp(link, paciente.nome, s.exercicio)}
                            className="text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-1.5 rounded-lg transition"
                          >
                            {linkCopiado ? "Copiado! ✓" : "📲 WhatsApp"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Modal — adicionar paciente */}
      {mostrarModalPaciente && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Adicionar paciente</h2>
              <button
                onClick={() => setMostrarModalPaciente(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={novoPaciente.nome}
                  onChange={(e) => setNovoPaciente({ ...novoPaciente, nome: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && salvarPaciente()}
                  placeholder="Nome completo"
                  autoFocus
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Telefone (opcional)</label>
                <input
                  type="tel"
                  value={novoPaciente.telefone}
                  onChange={(e) => setNovoPaciente({ ...novoPaciente, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1.5">E-mail (opcional)</label>
                <input
                  type="email"
                  value={novoPaciente.email}
                  onChange={(e) => setNovoPaciente({ ...novoPaciente, email: e.target.value })}
                  placeholder="paciente@email.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {erroPaciente && (
                <p className="text-red-400 text-xs">{erroPaciente}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setMostrarModalPaciente(false)}
                  className="flex-1 py-3 border border-white/20 hover:bg-white/5 rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarPaciente}
                  disabled={salvandoPaciente || !novoPaciente.nome.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition"
                >
                  {salvandoPaciente ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — gerar link de exercício */}
      {mostrarModalLink && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Novo exercício</h2>
              <button
                onClick={() => { setMostrarModalLink(false); setLinkGerado(null); }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {!linkGerado ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Paciente</label>
                  <select
                    value={form.pacienteId}
                    onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecionar paciente...</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Exercício</label>
                  <select
                    value={form.exercicio}
                    onChange={(e) => setForm({ ...form, exercicio: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecionar exercício...</option>
                    {EXERCICIOS_COMUNS.map((ex) => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Descrição (opcional)</label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex: Fique com os pés na largura dos ombros..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">
                    Repetições alvo: <span className="text-white font-medium">{form.repeticoesAlvo}</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={form.repeticoesAlvo}
                    onChange={(e) => setForm({ ...form, repeticoesAlvo: Number(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>5</span><span>30</span>
                  </div>
                </div>

                <button
                  onClick={gerarLink}
                  disabled={!form.pacienteId || !form.exercicio || gerandoLink}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition"
                >
                  {gerandoLink ? "Gerando..." : "Gerar link"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-medium mb-2">✅ Link gerado!</p>
                  <p className="text-xs text-gray-400 break-all">{linkGerado}</p>
                </div>

                <button
                  onClick={() => {
                    const pacienteSel = pacientes.find((p) => p.id === form.pacienteId);
                    if (pacienteSel && linkGerado) {
                      copiarParaWhatsApp(linkGerado, pacienteSel.nome, form.exercicio);
                    }
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  📲 {linkCopiado ? "Mensagem copiada!" : "Copiar para WhatsApp"}
                </button>

                <button
                  onClick={() => {
                    setLinkGerado(null);
                    setForm({ pacienteId: "", exercicio: "", descricao: "", repeticoesAlvo: 10 });
                  }}
                  className="w-full py-3 border border-white/20 hover:bg-white/5 rounded-xl text-sm transition"
                >
                  Novo link
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
