import React, { useState } from 'react';
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
  ExternalLink,
  Layers,
  Cpu
} from 'lucide-react';

export default function PRWalkthroughModal({
  isOpen,
  onClose,
  data,
  loading,
  onSelectFile
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyMarkdown = () => {
    if (!data) return;
    const lines = [
      `# Walkthrough Técnico da Task`,
      ``,
      `## Resumo Executivo`,
      data.executive_summary || '',
      ``,
      `## Novas Capacidades da Aplicação`,
      ...(data.new_capabilities || []).map((c) => `- ${c}`),
      ``,
      `## Fluxo Arquitetural`,
      data.architectural_story || '',
      ``,
      `## Detalhamento Arquivo por Arquivo`,
      ...(data.files_explained || []).map((f) => {
        const badge = f.status === 'added' ? '[NOVO ARQUIVO]' : '[MODIFICADO]';
        return `### ${badge} \`${f.path}\`\n- **Papel no sistema:** ${f.purpose || ''}\n- **O que foi adicionado/modificado:** ${f.code_changes || ''}\n- **Impacto:** ${f.impact || ''}\n`;
      })
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Walkthrough da Task
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  O que Mudou & Adicionou
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                História da task contada via código: entenda as novas capacidades e o papel de cada arquivo
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

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-200">
                Lendo diffs e analisando código de todos os arquivos com a IA...
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                A IA está cruzando a árvore sintática (AST), commits e modificações para montar a narrativa técnica da sua task.
              </p>
            </div>
          ) : !data || data.error ? (
            <div className="p-6 bg-rose-950/30 border border-rose-800/60 rounded-xl text-xs text-rose-300">
              <p className="font-semibold mb-1">Não foi possível gerar a explicação:</p>
              <p>{data?.error || 'Nenhum dado retornado pela IA. Verifique se o Claude CLI ou chave Gemini estão configurados.'}</p>
            </div>
          ) : (
            <>
              {/* Resumo Executivo */}
              <div className="p-5 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Resumo do que a Task Entrega</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                  {data.executive_summary}
                </p>

                {/* Novas Capacidades */}
                {data.new_capabilities && data.new_capabilities.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Novas Capacidades do Sistema:
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
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Fluxo Arquitetural Entre as Peças:
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {data.architectural_story}
                  </p>
                </div>
              )}

              {/* Detalhamento Arquivo por Arquivo */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Arquivos Explicados Contando via Código ({data.files_explained?.length || 0}):
                </span>

                <div className="space-y-3">
                  {(data.files_explained || []).map((file, idx) => {
                    const isAdded = file.status === 'added';
                    const isModified = file.status === 'modified';

                    return (
                      <div
                        key={`file-exp-${idx}`}
                        className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 transition"
                      >
                        {/* Header do Arquivo */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2 truncate">
                            {isAdded ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <FilePlus className="w-3 h-3" />
                                {file.badge_label || 'Novo Arquivo'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <FileEdit className="w-3 h-3" />
                                {file.badge_label || 'Arquivo Modificado'}
                              </span>
                            )}
                            <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                              {file.path}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              onSelectFile(file.path);
                              onClose();
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-slate-900 transition"
                            title="Abrir este arquivo no visualizador"
                          >
                            <span>Ver no Editor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* O que o arquivo faz */}
                        {file.purpose && (
                          <div className="text-xs">
                            <strong className="text-slate-400 block text-[11px] mb-0.5">
                              Papel no Sistema:
                            </strong>
                            <p className="text-slate-300">{file.purpose}</p>
                          </div>
                        )}

                        {/* O que foi adicionado / modificado via código */}
                        {file.code_changes && (
                          <div className="text-xs p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/90 font-mono text-slate-300 space-y-1">
                            <strong className="text-indigo-300 block text-[11px] font-sans">
                              Alterações Específicas de Código:
                            </strong>
                            <p className="whitespace-pre-line text-[11px] leading-relaxed">
                              {file.code_changes}
                            </p>
                          </div>
                        )}

                        {/* Impacto */}
                        {file.impact && (
                          <div className="text-xs text-slate-400">
                            <span className="font-medium text-slate-300">Impacto no app: </span>
                            <span>{file.impact}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Use esta explicação para acelerar seu review e alinhar com o time
          </span>

          <div className="flex items-center gap-2">
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
              <span>{copied ? 'Copiado em Markdown!' : 'Copiar Explicação Completa'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
