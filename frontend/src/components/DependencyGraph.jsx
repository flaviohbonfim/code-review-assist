import React from 'react';
import { X, Network, Layers, ArrowRight } from 'lucide-react';

export default function DependencyGraph({ isOpen, onClose, summary, graph, onSelectFile }) {
  if (!isOpen) return null;

  const layers = summary?.layers || {};
  const edges = graph?.edges || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header do Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Mapa Arquitetural e Fluxo da Task</h2>
              <p className="text-xs text-slate-400">
                Visualização das camadas impactadas e conexões de imports (AST) entre os arquivos do PR
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

        {/* Conteúdo do Grafo / Diagrama por Camada */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Conexões diretas via AST entre arquivos do PR */}
          {edges.length > 0 && (
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2.5">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5" />
                Fluxo de Dependências Diretas no PR (via AST Python):
              </span>
              <div className="flex flex-wrap gap-2">
                {edges.map((edge, idx) => (
                  <div
                    key={`edge-${idx}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300"
                  >
                    <span className="text-emerald-400">{edge.from_label}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-indigo-300">{edge.to_label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(layers).map(([layerName, files]) => {
              const logicFiles = files.filter((f) => !f.is_mechanical_noise);
              const noiseFiles = files.filter((f) => f.is_mechanical_noise);

              return (
                <div
                  key={layerName}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        {layerName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {files.length} arqs
                      </span>
                    </div>

                    <div className="space-y-1 mt-3">
                      {files.slice(0, 6).map((f) => (
                        <div
                          key={f.path}
                          onClick={() => {
                            onSelectFile(f);
                            onClose();
                          }}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-800/80 cursor-pointer text-slate-300 hover:text-indigo-300 transition"
                        >
                          <span className="truncate font-mono text-[11px]" title={f.path}>
                            {f.filename}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            +{f.added} -{f.deleted}
                          </span>
                        </div>
                      ))}
                      {files.length > 6 && (
                        <p className="text-[10px] text-slate-500 italic pl-2 pt-1">
                          + outros {files.length - 6} arquivos...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{logicFiles.length} de lógica</span>
                    <span>{noiseFiles.length} de ruído</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dica de Fluxo de Leitura */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 space-y-1">
            <strong className="block font-semibold">Ordem Recomendada de Code Review:</strong>
            <p className="text-slate-300">
              1. Comece pelas <strong>Models & Schemas</strong> (para entender as estruturas de dados novas).
              <br />
              2. Revise o <strong>Domínio / Services</strong> (onde mora a regra de negócio central).
              <br />
              3. Valide <strong>API / Routers</strong> (contrato de entrada e saída).
              <br />
              4. Por fim, cheque <strong>Testes</strong> e deixe <strong>Ruídos Mecânicos</strong> por último.
            </p>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Fechar Mapa
          </button>
        </div>
      </div>
    </div>
  );
}
