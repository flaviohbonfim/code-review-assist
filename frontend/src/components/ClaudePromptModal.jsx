import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, Terminal, Trash2 } from 'lucide-react';

export default function ClaudePromptModal({
  isOpen,
  onClose,
  promptText,
  reviewNotes,
  onClearNotes
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Prompt de Correção para o Claude Code
              </h2>
              <p className="text-xs text-slate-400">
                Copie e cole diretamente no Claude Code para que ele aplique todas as correções de uma só vez
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

        {/* Resumo de Notas Inclusas */}
        <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total de apontamentos incluídos:{' '}
            <strong className="text-purple-300 font-mono">{reviewNotes.length}</strong> itens
          </span>
          {reviewNotes.length > 0 && (
            <button
              onClick={onClearNotes}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Notas</span>
            </button>
          )}
        </div>

        {/* Área do Prompt Gerado */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs">
          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
            {promptText}
          </pre>
        </div>

        {/* Rodapé com Botão de Copiar */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            Cole no terminal do seu Claude Code (`claude`) na raiz da task
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado para o Clipboard!' : 'Copiar Prompt'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
