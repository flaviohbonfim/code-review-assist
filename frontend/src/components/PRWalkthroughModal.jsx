import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  FileCode,
  FilePlus,
  FileEdit,
  ArrowRight,
  Copy,
  Check,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  Code2,
  Activity,
  FileCheck2,
  Flame,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { getFileDiff } from '../api';
import { exportWalkthroughHTML } from '../utils/htmlExporter';

export default function PRWalkthroughModal({
  isOpen = true,
  onClose,
  data,
  loading,
  onSelectFile,
  onReload,
  repoPath,
  baseBranch,
  headBranch,
  mode = 'fullpage'  // 'fullpage' | 'modal'
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'new_files' | 'modified_files' | 'senior_audit'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('all');
  const [copied, setCopied] = useState(false);

  // Estado do visualizador de diff embutido dentro de cada card
  const [expandedDiffs, setExpandedDiffs] = useState({});

  const handleToggleDiff = async (filePath) => {
    const current = expandedDiffs[filePath];
    if (current?.isOpen) {
      setExpandedDiffs((prev) => ({
        ...prev,
        [filePath]: { ...prev[filePath], isOpen: false }
      }));
      return;
    }

    if (current?.diff) {
      setExpandedDiffs((prev) => ({
        ...prev,
        [filePath]: { ...prev[filePath], isOpen: true }
      }));
      return;
    }

    setExpandedDiffs((prev) => ({
      ...prev,
      [filePath]: { loading: true, error: null, isOpen: true, diff: null }
    }));

    try {
      const res = await getFileDiff(repoPath, baseBranch, headBranch, filePath);
      setExpandedDiffs((prev) => ({
        ...prev,
        [filePath]: { loading: false, error: null, isOpen: true, diff: res }
      }));
    } catch (err) {
      setExpandedDiffs((prev) => ({
        ...prev,
        [filePath]: { loading: false, error: err.message, isOpen: true, diff: null }
      }));
    }
  };

  // Mapeamentos rápidos de análise aprofundada da IA
  const newAnalysisMap = useMemo(() => {
    const map = new Map();
    if (data?.new_files_analysis) {
      data.new_files_analysis.forEach((item) => {
        if (item.path) map.set(item.path, item);
      });
    }
    return map;
  }, [data]);

  const modAnalysisMap = useMemo(() => {
    const map = new Map();
    if (data?.modified_files_analysis) {
      data.modified_files_analysis.forEach((item) => {
        if (item.path) map.set(item.path, item);
      });
    }
    return map;
  }, [data]);

  // Lista unificada de todos os arquivos adicionados
  const addedFiles = useMemo(() => {
    if (data?.all_added_files && data.all_added_files.length > 0) {
      return data.all_added_files;
    }
    if (data?.new_files_analysis) {
      return data.new_files_analysis.map((f) => ({
        path: f.path,
        filename: f.filename,
        status: 'added',
        added: 0,
        deleted: 0,
        layer: 'Domínio / Services'
      }));
    }
    return [];
  }, [data]);

  // Lista unificada de todos os arquivos modificados
  const modifiedFiles = useMemo(() => {
    if (data?.all_modified_files && data.all_modified_files.length > 0) {
      return data.all_modified_files;
    }
    if (data?.modified_files_analysis) {
      return data.modified_files_analysis.map((f) => ({
        path: f.path,
        filename: f.filename,
        status: 'modified',
        added: 0,
        deleted: 0,
        layer: 'Domínio / Services'
      }));
    }
    return [];
  }, [data]);

  // Camadas disponíveis para filtro
  const availableLayers = useMemo(() => {
    const set = new Set();
    [...addedFiles, ...modifiedFiles].forEach((f) => {
      if (f.layer) set.add(f.layer);
    });
    return Array.from(set);
  }, [addedFiles, modifiedFiles]);

  // Filtro de busca e camada para novos arquivos
  const filteredAddedFiles = useMemo(() => {
    return addedFiles.filter((f) => {
      const matchSearch =
        !searchQuery ||
        f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLayer = selectedLayer === 'all' || f.layer === selectedLayer;
      return matchSearch && matchLayer;
    });
  }, [addedFiles, searchQuery, selectedLayer]);

  // Filtro de busca e camada para modificados
  const filteredModifiedFiles = useMemo(() => {
    return modifiedFiles.filter((f) => {
      const matchSearch =
        !searchQuery ||
        f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLayer = selectedLayer === 'all' || f.layer === selectedLayer;
      return matchSearch && matchLayer;
    });
  }, [modifiedFiles, searchQuery, selectedLayer]);

  if (!isOpen && mode !== 'fullpage') return null;

  // Handler de export HTML standalone
  const handleExportHTML = () => {
    if (!data) return;
    const repoName = repoPath ? repoPath.split('/').pop() : 'repo';
    exportWalkthroughHTML(data, repoName, baseBranch, headBranch);
  };

  // Gerador completo de relatório em Markdown
  const handleCopyMarkdown = () => {
    if (!data) return;
    const audit = data.senior_audit || {};

    const lines = [
      `# Walkthrough Técnico da Task & Auditoria de Pull Request`,
      ``,
      `## 1. Resumo Executivo`,
      data.executive_summary || 'Resumo não gerado.',
      ``,
      `## 2. Novas Capacidades da Aplicação`,
      ...(data.new_capabilities || []).map((c) => `- ${c}`),
      ``,
      `## 3. Fluxo Arquitetural Entre as Peças`,
      data.architectural_story || 'Fluxo não documentado.',
      ``,
      `---`,
      `## 4. Auditoria Sênior (Quality Gate: SOLID, Clean Code, YAGNI)`,
      `### 💎 Princípios SOLID & Arquitetura`,
      audit.solid_summary || 'Em conformidade com a arquitetura do projeto.',
      ``,
      `### 🧼 Clean Code & Boas Práticas`,
      audit.clean_code_summary || 'Boas práticas seguidas.',
      ``,
      `### 🎯 YAGNI / KISS (Anti-Overengineering)`,
      audit.yagni_summary || 'Solução pragmática sem complexidade desnecessária.',
      ``,
      `### ⚠️ Riscos de Regressão & Contratos`,
      audit.risks_and_regressions || 'Baixo risco de quebra de contrato.',
      ``,
      `### 🧪 Avaliação de Testes`,
      audit.testing_evaluation || 'Testes unitários e de integração adicionados.',
      ``,
      `---`,
      `## 5. Novos Arquivos Adicionados (${addedFiles.length} arquivos)`,
      ...(data.new_files_analysis || []).map((f) => {
        return [
          `### [NOVO ARQUIVO] \`${f.path}\``,
          `- **Papel no Sistema:** ${f.purpose || ''}`,
          `- **SOLID:** ${f.solid_rating || 'OK'} - ${f.solid_comment || ''}`,
          `- **Clean Code:** ${f.clean_code_rating || 'OK'} - ${f.clean_code_comment || ''}`,
          `- **YAGNI:** ${f.yagni_rating || 'Pragmático'} - ${f.yagni_comment || ''}`,
          f.code_highlights ? `- **Alterações em Código:** ${f.code_highlights}` : '',
          f.senior_recommendation ? `- **Recomendação Sênior:** ${f.senior_recommendation}` : '',
          ``
        ].filter(Boolean).join('\n');
      }),
      ``,
      `## 6. Arquivos Modificados (${modifiedFiles.length} arquivos)`,
      ...(data.modified_files_analysis || []).map((f) => {
        return [
          `### [MODIFICADO] \`${f.path}\``,
          `- **Papel no Sistema:** ${f.purpose || ''}`,
          `- **O que mudou:** ${f.changes_summary || ''}`,
          `- **Risco de Regressão:** ${f.regression_risk || 'Baixo'} - ${f.regression_notes || ''}`,
          f.clean_code_notes ? `- **Clean Code:** ${f.clean_code_notes}` : '',
          ``
        ].filter(Boolean).join('\n');
      }),
      ``,
      `---`,
      `*Relatório gerado automaticamente pelo Code Review Assist*`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper de badges visuais
  const renderBadge = (type, val) => {
    const v = (val || '').toLowerCase();
    if (type === 'solid') {
      if (v.includes('viola') || v.includes('erro')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">Violação SOLID</span>;
      }
      if (v.includes('aten') || v.includes('warning')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">Atenção SOLID</span>;
      }
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">SOLID: OK</span>;
    }
    if (type === 'clean') {
      if (v.includes('sugest') || v.includes('melhoria')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">Clean Code: Sugestão</span>;
      }
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">Clean Code: Aprovado</span>;
    }
    if (type === 'yagni') {
      if (v.includes('overengineering') || v.includes('alerta') || v.includes('prematur')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/30">Alerta YAGNI</span>;
      }
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">YAGNI: Pragmático</span>;
    }
    if (type === 'risk') {
      if (v.includes('alto')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">Risco Alto</span>;
      }
      if (v.includes('médio') || v.includes('medio')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">Risco Médio</span>;
      }
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Risco Baixo</span>;
    }
    return null;
  };

  // Renderizador do Diff Inline Embutido no Card
  const renderInlineDiff = (filePath, filename) => {
    const diffState = expandedDiffs[filePath];
    if (!diffState || !diffState.isOpen) return null;

    if (diffState.loading) {
      return (
        <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Carregando diff e código de {filename}...</span>
        </div>
      );
    }

    if (diffState.error) {
      return (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          Falha ao carregar diff: {diffState.error}
        </div>
      );
    }

    const diff = diffState.diff;
    if (!diff) return null;

    const headLines = (diff.head_content || '').split('\n');
    const lineStatuses = diff.line_statuses || {};
    const removedBlocks = diff.removed_blocks_by_line || {};

    return (
      <div className="mt-2 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
        <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-300 text-[11px] truncate flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            Código / Alterações ({filename})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectFile(filePath)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1"
            >
              <span>Abrir no Editor Principal</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleToggleDiff(filePath)}
              className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              Recolher
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed divide-y divide-slate-900">
          {headLines.length > 0 && diff.head_content ? (
            headLines.map((line, idx) => {
              const lineNum = idx + 1;
              const status = lineStatuses[String(lineNum)] || 'unchanged';
              const removedLines = removedBlocks[String(lineNum)] || [];

              return (
                <React.Fragment key={`inline-line-${lineNum}`}>
                  {removedLines.map((rLine, rIdx) => (
                    <div
                      key={`rem-${lineNum}-${rIdx}`}
                      className="flex items-start bg-rose-950/40 text-rose-300 px-2 py-0.5 border-l-2 border-rose-500 hover:bg-rose-950/60 transition"
                    >
                      <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-3">-</span>
                      <pre className="flex-1 whitespace-pre-wrap break-all">{rLine}</pre>
                    </div>
                  ))}

                  <div
                    className={`flex items-start px-2 py-0.5 transition ${
                      status === 'added'
                        ? 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500'
                        : status === 'modified'
                        ? 'bg-amber-950/30 text-amber-200 border-l-2 border-amber-500'
                        : 'text-slate-300 hover:bg-slate-900/50'
                    }`}
                  >
                    <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-3">{lineNum}</span>
                    <pre className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</pre>
                  </div>
                </React.Fragment>
              );
            })
          ) : diff.raw_diff ? (
            <pre className="text-slate-300 whitespace-pre-wrap p-2 text-xs">{diff.raw_diff}</pre>
          ) : (
            <p className="p-3 text-slate-500 text-xs">Arquivo vazio ou sem alterações detectadas.</p>
          )}
        </div>
      </div>
    );
  };

  const totalFiles = data?.stats?.total_files || (addedFiles.length + modifiedFiles.length);

  // Helper de botões de aba
  const renderTabButton = (tabId, label, icon, color, count = null, showBadge = false) => {
    const isActive = activeTab === tabId;
    return (
      <button
        onClick={() => setActiveTab(tabId)}
        className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold transition ${
          isActive
            ? `border-${color}-500 text-${color}-300 bg-${color}-500/10`
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
        }`}
      >
        {icon}
        <span>{label}</span>
        {count !== null && count !== undefined && (
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-${color}-500/20 text-${color}-300 border border-${color}-500/30`}>
            {count}
          </span>
        )}
        {showBadge && (
          <span className="px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            SOLID • Clean • YAGNI
          </span>
        )}
      </button>
    );
  };

  // Renderizador unificado do corpo das abas
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-200">
            Analisando os diffs e executando auditoria arquitetural com a IA...
          </p>
          <p className="text-xs text-slate-500 max-w-md">
            Cruzando AST, contratos de entrada e saída, e avaliando aderência a SOLID, Clean Code e YAGNI.
          </p>
        </div>
      );
    }

    if (!data || data.error) {
      return (
        <div className="p-6 bg-rose-950/30 border border-rose-800/60 rounded-xl text-xs text-rose-300 space-y-3">
          <div className="flex items-center gap-2 text-rose-200 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Não foi possível gerar a explicação do PR:</span>
          </div>
          <p className="font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-rose-900/50">
            {data?.error || 'Nenhum dado retornado. Verifique se o Antigravity, Claude CLI ou Gemini estão configurados.'}
          </p>
          {onReload && (
            <button
              onClick={onReload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/50 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-lg text-xs font-medium transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* ================================= ABA 1: VISÃO GERAL ================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Cards de Métricas da Task */}
            {data.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total de Arquivos</span>
                  <span className="text-lg font-bold text-slate-200 font-mono">{data.stats.total_files}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-emerald-500/20 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Arquivos Novos</span>
                  <span className="text-lg font-bold text-emerald-300 font-mono">+{data.stats.total_added}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">Modificados</span>
                  <span className="text-lg font-bold text-amber-300 font-mono">~{data.stats.total_modified}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-indigo-500/20 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block">Linhas Alteradas</span>
                  <span className="text-xs font-mono font-bold text-slate-300 block mt-1">
                    <span className="text-emerald-400">+{data.stats.total_lines_added}</span> / <span className="text-rose-400">-{data.stats.total_lines_deleted}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Resumo Executivo */}
            <div className="p-5 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-xl space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Resumo Executivo da Entrega</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                {data.executive_summary || 'Resumo da entrega processado via análise de diffs do PR.'}
              </p>

              {/* Novas Capacidades */}
              {data.new_capabilities && data.new_capabilities.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Novas Capacidades que a Aplicação Ganhou:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {data.new_capabilities.map((cap, cIdx) => (
                      <div
                        key={`cap-${cIdx}`}
                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 font-medium"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Narrativa Arquitetural & Fluxo */}
            {data.architectural_story && (
              <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Fluxo Arquitetural Entre as Peças:
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    End-to-End Pipeline
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.architectural_story}
                </p>
              </div>
            )}

            {/* Snapshot Rápido da Auditoria Sênior com Atalho */}
            {data.senior_audit && (
              <div className="p-5 bg-slate-950 border border-purple-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Parecer Resumido da Auditoria Sênior
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('senior_audit')}
                    className="text-[11px] font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <span>Ver Auditoria Completa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                    <strong className="text-[11px] text-indigo-300 block font-sans">💎 SOLID & SRP</strong>
                    <p className="text-[11px] text-slate-400 line-clamp-3">
                      {data.senior_audit.solid_summary || 'Respeito à responsabilidade única e desacoplamento.'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                    <strong className="text-[11px] text-blue-300 block font-sans">🧼 Clean Code</strong>
                    <p className="text-[11px] text-slate-400 line-clamp-3">
                      {data.senior_audit.clean_code_summary || 'Nomes expressivos e ausência de aninhamentos profundos.'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                    <strong className="text-[11px] text-emerald-300 block font-sans">🎯 YAGNI / KISS</strong>
                    <p className="text-[11px] text-slate-400 line-clamp-3">
                      {data.senior_audit.yagni_summary || 'Implementação direta sem abstrações prematuras.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================= ABA 2: NOVOS ARQUIVOS ================================= */}
        {activeTab === 'new_files' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por arquivo novo ou caminho..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {availableLayers.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Camada:</span>
                  <button
                    onClick={() => setSelectedLayer('all')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      selectedLayer === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Todas ({addedFiles.length})
                  </button>
                  {availableLayers.map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLayer(l)}
                      className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition ${
                        selectedLayer === l
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredAddedFiles.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 border border-slate-800 rounded-xl">
                  Nenhum arquivo novo encontrado com os filtros atuais.
                </div>
              ) : (
                filteredAddedFiles.map((file, idx) => {
                  const analysis = newAnalysisMap.get(file.path);

                  return (
                    <div
                      key={`added-file-${idx}`}
                      className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                        <div className="flex items-center gap-2 truncate">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <FilePlus className="w-3 h-3" />
                            Novo Arquivo
                          </span>
                          {file.layer && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                              {file.layer}
                            </span>
                          )}
                          <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                            {file.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {file.added > 0 && (
                            <span className="text-[11px] font-mono font-medium text-emerald-400">
                              +{file.added} linhas
                            </span>
                          )}

                          <button
                            onClick={() => handleToggleDiff(file.path)}
                            className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                            title="Ver código e alterações direto aqui"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>{expandedDiffs[file.path]?.isOpen ? 'Ocultar Código' : 'Ver Código / Diff'}</span>
                            {expandedDiffs[file.path]?.isOpen ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              onSelectFile(file.path);
                              if (onClose && mode === 'modal') onClose();
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                            title="Abrir este arquivo no editor principal"
                          >
                            <span>Ver no Editor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {analysis ? (
                        <div className="space-y-3">
                          {analysis.purpose && (
                            <div className="text-xs">
                              <strong className="text-slate-400 block text-[11px] mb-0.5">
                                Papel no Sistema:
                              </strong>
                              <p className="text-slate-300">{analysis.purpose}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/90 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-indigo-300 font-sans">
                                  Princípios SOLID
                                </span>
                                {renderBadge('solid', analysis.solid_rating)}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {analysis.solid_comment || 'Sem violação observada.'}
                              </p>
                            </div>

                            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/90 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-blue-300 font-sans">
                                  Clean Code & PEP 8
                                </span>
                                {renderBadge('clean', analysis.clean_code_rating)}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {analysis.clean_code_comment || 'Código limpo e legível.'}
                              </p>
                            </div>

                            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/90 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-emerald-300 font-sans">
                                  YAGNI / Simplicidade
                                </span>
                                {renderBadge('yagni', analysis.yagni_rating)}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {analysis.yagni_comment || 'Sem overengineering detectado.'}
                              </p>
                            </div>
                          </div>

                          {analysis.code_highlights && (
                            <div className="text-xs p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/90 font-mono text-slate-300 space-y-1">
                              <strong className="text-indigo-300 block text-[11px] font-sans">
                                Alterações Específicas de Código:
                              </strong>
                              <p className="whitespace-pre-line text-[11px] leading-relaxed">
                                {analysis.code_highlights}
                              </p>
                            </div>
                          )}

                          {analysis.senior_recommendation && (
                            <div className="text-[11px] p-2 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-indigo-300 flex items-start gap-1.5">
                              <Info className="w-3.5 h-3.5 mt-0.5 text-indigo-400 shrink-0" />
                              <span><strong>Recomendação Sênior:</strong> {analysis.senior_recommendation}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Arquivo registrado no commit ({file.layer || 'Código'}). Clique em 'Ver Código / Diff' para inspecionar as linhas aqui mesmo.
                        </div>
                      )}

                      {renderInlineDiff(file.path, file.filename)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================================= ABA 3: ARQUIVOS MODIFICADOS ================================= */}
        {activeTab === 'modified_files' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por arquivo modificado ou caminho..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {availableLayers.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Camada:</span>
                  <button
                    onClick={() => setSelectedLayer('all')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      selectedLayer === 'all'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Todas ({modifiedFiles.length})
                  </button>
                  {availableLayers.map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLayer(l)}
                      className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition ${
                        selectedLayer === l
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredModifiedFiles.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 border border-slate-800 rounded-xl">
                  Nenhum arquivo modificado encontrado com os filtros atuais.
                </div>
              ) : (
                filteredModifiedFiles.map((file, idx) => {
                  const analysis = modAnalysisMap.get(file.path);

                  return (
                    <div
                      key={`mod-file-${idx}`}
                      className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                        <div className="flex items-center gap-2 truncate">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            <FileEdit className="w-3 h-3" />
                            Modificado
                          </span>
                          {file.layer && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                              {file.layer}
                            </span>
                          )}
                          <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                            {file.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-medium text-slate-400">
                            <span className="text-emerald-400">+{file.added || 0}</span> / <span className="text-rose-400">-{file.deleted || 0}</span>
                          </span>

                          <button
                            onClick={() => handleToggleDiff(file.path)}
                            className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                            title="Ver alterações direto aqui"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>{expandedDiffs[file.path]?.isOpen ? 'Ocultar Código' : 'Ver Código / Diff'}</span>
                            {expandedDiffs[file.path]?.isOpen ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              onSelectFile(file.path);
                              if (onClose && mode === 'modal') onClose();
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                            title="Abrir este arquivo no editor principal"
                          >
                            <span>Ver no Editor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {analysis ? (
                        <div className="space-y-2.5">
                          {analysis.purpose && (
                            <div className="text-xs">
                              <strong className="text-slate-400 block text-[11px] mb-0.5">
                                Papel no Sistema:
                              </strong>
                              <p className="text-slate-300">{analysis.purpose}</p>
                            </div>
                          )}

                          {analysis.changes_summary && (
                            <div className="text-xs p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/90 font-mono text-slate-300 space-y-1">
                              <strong className="text-amber-300 block text-[11px] font-sans">
                                O Que Mudou Neste Arquivo:
                              </strong>
                              <p className="whitespace-pre-line text-[11px] leading-relaxed">
                                {analysis.changes_summary}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-medium text-[11px]">Risco de Regressão:</span>
                              {renderBadge('risk', analysis.regression_risk)}
                            </div>
                            {analysis.regression_notes && (
                              <span className="text-slate-400 text-[11px]">
                                {analysis.regression_notes}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Arquivo modificado na task. Clique em 'Ver Código / Diff' para revisar as alterações aqui no card.
                        </div>
                      )}

                      {renderInlineDiff(file.path, file.filename)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================================= ABA 4: AUDITORIA SÊNIOR ================================= */}
        {activeTab === 'senior_audit' && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Quality Gate de Engenharia de Software
                </h3>
                <p className="text-xs text-slate-400">
                  Checklist sênior de validação técnica para garantir a saúde da base de código antes do merge
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Princípios SOLID (SRP, OCP, LSP, ISP, DIP)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase">Arquitetura de Objetos</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.senior_audit?.solid_summary || 'Não foram detectadas violações gritantes nos novos componentes.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Clean Code & Pythonismo (PEP 8, Nomenclatura, Type Hints)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 uppercase">Legibilidade</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.senior_audit?.clean_code_summary || 'Nomenclaturas adequadas e tipagens consistentes aplicadas.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      YAGNI & KISS (Filtro Anti-Overengineering)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase">Pragmatismo</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.senior_audit?.yagni_summary || 'O código resolve estritamente o problema da task sem criar abstrações prematuras ou desnecessárias.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Riscos de Regressão & Quebra de Contratos
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase">Resiliência</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.senior_audit?.risks_and_regressions || 'Sem quebras de contrato de eventos ou banco identificadas.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Estratégia & Qualidade dos Testes
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 uppercase">Garantia da Qualidade</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {data.senior_audit?.testing_evaluation || 'Testes cobrem cenários essenciais e isolamento de dependências externas.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // MODO 1: FULLPAGE (Aba na página inteira, sem modal bloqueante)
  if (mode === 'fullpage') {
    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-115px)] overflow-hidden bg-slate-950">
        {/* Header da Aba */}
        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Walkthrough Técnico da Task & Auditoria de PR
                </h2>
                {totalFiles > 0 && (
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    {totalFiles} arquivos
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                História da task contada via código com auditoria em SOLID, Clean Code e YAGNI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReload && (
              <button
                onClick={onReload}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
                title="Recalcular Walkthrough com a IA"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            )}

            <button
              onClick={handleExportHTML}
              disabled={loading || !data || data.error}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/90 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              title="Abre o relatório completo em uma nova aba como HTML auto-contido para impressão ou compartilhamento"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir em Nova Aba (HTML)</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              disabled={loading || !data || data.error}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Markdown'}</span>
            </button>
          </div>
        </div>

        {/* Tab Bar Superior */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1">
            {renderTabButton('overview', 'Visão Geral & Arquitetura', <Sparkles className="w-4 h-4 text-indigo-400" />, 'indigo')}
            {renderTabButton('new_files', 'Novos Arquivos', <FilePlus className="w-4 h-4 text-emerald-400" />, 'emerald', addedFiles.length)}
            {renderTabButton('modified_files', 'Arquivos Modificados', <FileEdit className="w-4 h-4 text-amber-400" />, 'amber', modifiedFiles.length)}
            {renderTabButton('senior_audit', 'Auditoria Sênior (Quality Gate)', <ShieldCheck className="w-4 h-4 text-purple-400" />, 'purple', null, true)}
          </div>
          {data?.stats && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="text-emerald-400">+{data.stats.total_lines_added || 0}</span>
              <span>/</span>
              <span className="text-rose-400">-{data.stats.total_lines_deleted || 0}</span>
            </div>
          )}
        </div>

        {/* Conteúdo com scroll natural amplo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderTabContent()}
        </div>
      </div>
    );
  }

  // MODO 2: MODAL (Fallback clássico)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Walkthrough Técnico da Task & Auditoria de PR
                </h2>
                {totalFiles > 0 && (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    {totalFiles} arquivos
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                História da task contada via código com auditoria em SOLID, Clean Code e YAGNI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            {renderTabButton('overview', 'Visão Geral & Arquitetura', <Sparkles className="w-4 h-4 text-indigo-400" />, 'indigo')}
            {renderTabButton('new_files', 'Novos Arquivos', <FilePlus className="w-4 h-4 text-emerald-400" />, 'emerald', addedFiles.length)}
            {renderTabButton('modified_files', 'Arquivos Modificados', <FileEdit className="w-4 h-4 text-amber-400" />, 'amber', modifiedFiles.length)}
            {renderTabButton('senior_audit', 'Auditoria Sênior (Quality Gate)', <ShieldCheck className="w-4 h-4 text-purple-400" />, 'purple', null, true)}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderTabContent()}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {totalFiles > 0 ? `${totalFiles} arquivos mapeados no PR` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportHTML}
              disabled={loading || !data || data.error}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir HTML</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Fechar
            </button>
            <button
              onClick={handleCopyMarkdown}
              disabled={loading || !data || data.error}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Markdown'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
