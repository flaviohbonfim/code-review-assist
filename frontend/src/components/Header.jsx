import React from 'react';
import { GitBranch, GitPullRequest, Folder, FolderOpen, Sparkles, Network, RefreshCw, Layers } from 'lucide-react';

export default function Header({
  repoPath,
  setRepoPath,
  branches,
  baseBranch,
  setBaseBranch,
  headBranch,
  setHeadBranch,
  onLoadBranches,
  onSelectFolderViaFinder,
  onCompare,
  summary,
  loading,
  progress,
  onOpenGraph,
  onOpenClaudePrompt
}) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 sticky top-0 z-30 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Título */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GitPullRequest className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 flex items-center gap-2">
              Code Review Assist
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                AI + AST Visual
              </span>
            </h1>
            <p className="text-xs text-slate-400">Revisão visual inteligente para PRs extensos</p>
          </div>
        </div>

        {/* Inputs de Repositório e Branches */}
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-950/70 border border-slate-800/90 rounded-xl p-1.5 shadow-inner">
          {/* Botão Selecionar no Finder */}
          <button
            type="button"
            onClick={onSelectFolderViaFinder}
            disabled={loading}
            title="Abrir o Finder do Mac para selecionar a pasta do repositório"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-indigo-500/20 transition disabled:opacity-40"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Finder...</span>
          </button>

          {/* Path do Repo */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
            <Folder className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onLoadBranches();
                }
              }}
              placeholder="/caminho/do/repositorio"
              className="bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none w-60 md:w-72 font-mono"
              title="Digite ou cole o caminho do repositório Git e pressione Enter ou clique em Carregar"
            />
            {repoPath && (
              <button
                type="button"
                onClick={() => setRepoPath('')}
                className="text-slate-500 hover:text-slate-300 text-xs px-1"
                title="Limpar caminho para digitar outro"
              >
                ✕
              </button>
            )}
            <button
              onClick={onLoadBranches}
              disabled={loading || !repoPath.trim()}
              title="Carregar branches deste repositório (Enter)"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded border border-indigo-500/20 transition disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-[11px] font-medium">Carregar</span>
            </button>
          </div>

          {/* Base Branch */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Base:</span>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none font-mono cursor-pointer"
            >
              {branches.length === 0 ? (
                <option value="">(nenhuma branch)</option>
              ) : (
                branches.map((b) => (
                  <option key={`base-${b}`} value={b} className="bg-slate-900 text-slate-200">
                    {b}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="text-slate-600 text-xs">←</div>

          {/* Head Branch */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Task:</span>
            <select
              value={headBranch}
              onChange={(e) => setHeadBranch(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-mono font-medium outline-none cursor-pointer"
            >
              {branches.length === 0 ? (
                <option value="">(nenhuma branch)</option>
              ) : (
                branches.map((b) => (
                  <option key={`head-${b}`} value={b} className="bg-slate-900 text-slate-200">
                    {b === '__WORKING_TREE__' ? '[Working Tree / Local]' : b}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={onCompare}
            disabled={loading || branches.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Comparar</span>
          </button>
        </div>

        {/* Ações e Resumo */}
        <div className="flex items-center gap-2.5">
          {summary && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <span className="flex items-center gap-1 text-slate-300">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <strong>{summary.total_files}</strong> arquivos
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-mono">+{summary.total_added}</span>
              <span className="text-rose-400 font-mono">-{summary.total_deleted}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 text-[11px]">
                {summary.logic_files_count} lógica / {summary.noise_files_count} ruído
              </span>
            </div>
          )}

          {/* Botão Grafo de Impacto */}
          <button
            onClick={onOpenGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            title="Visualizar Grafo de Fluxo e Dependências"
          >
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            <span>Mapa do PR</span>
          </button>

          {/* Botão Gerar Prompt Claude */}
          <button
            onClick={onOpenClaudePrompt}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-purple-500/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gerar Prompt Claude</span>
          </button>
        </div>
      </div>

      {/* Barra de Progresso de Revisão do PR */}
      {progress && progress.total > 0 && (
        <div className="mt-2.5 flex items-center gap-3 text-xs">
          <div className="flex-1 bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full transition-all duration-300"
              style={{ width: `${(progress.reviewed / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-slate-400 text-[11px] whitespace-nowrap">
            Progresso: <strong className="text-slate-200">{progress.reviewed}</strong> de {progress.total} arquivos ({Math.round((progress.reviewed / progress.total) * 100)}%)
          </span>
        </div>
      )}
    </header>
  );
}
