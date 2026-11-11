import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Code2,
  Split,
  Copy,
  Check,
  FileCode2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function CodeViewer({
  file,
  diffData,
  loadingDiff,
  aiFindings,
  manualNotes,
  onAddManualNote,
  onAddNoteToClaudePrompt,
  fileStatus,
  onSetStatus
}) {
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [showRemovedInline, setShowRemovedInline] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [collapsedBlocks, setCollapsedBlocks] = useState({});
  const [activeLineForNote, setActiveLineForNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const lineRefs = useRef({});

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-950/40">
        <Code2 className="w-12 h-12 mb-3 text-slate-700" />
        <p className="text-sm font-medium text-slate-400">Selecione um arquivo na árvore à esquerda para iniciar o code review</p>
        <p className="text-xs text-slate-600 mt-1">Os arquivos estão agrupados por camada arquitetural para facilitar a priorização.</p>
      </div>
    );
  }

  if (loadingDiff) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-950/40">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono">Carregando arquivo completo e processando AST de {file.filename}...</p>
      </div>
    );
  }

  const headLines = (diffData?.head_content || '').split('\n');
  const baseLines = (diffData?.base_content || '').split('\n');
  const lineStatuses = diffData?.line_statuses || [];
  const foldableRanges = diffData?.foldable_ranges || [];
  const removedBlocksByLine = diffData?.removed_blocks_by_line || {};

  const toggleBlockCollapse = (rangeId) => {
    setCollapsedBlocks((prev) => ({
      ...prev,
      [rangeId]: prev[rangeId] === undefined ? false : !prev[rangeId]
    }));
  };

  const collapseAllUnchanged = () => {
    const newCollapsed = {};
    foldableRanges.forEach((range, idx) => {
      if (range.can_collapse) {
        newCollapsed[`range-${idx}`] = true;
      }
    });
    setCollapsedBlocks(newCollapsed);
  };

  const expandAll = () => {
    const newCollapsed = {};
    foldableRanges.forEach((_, idx) => {
      newCollapsed[`range-${idx}`] = false;
    });
    setCollapsedBlocks(newCollapsed);
  };

  const scrollToLine = (lineNum, rangeIdx) => {
    if (rangeIdx !== undefined) {
      setCollapsedBlocks((prev) => ({ ...prev, [`range-${rangeIdx}`]: false }));
    }
    setTimeout(() => {
      const el = lineRefs.current[lineNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleSaveManualNote = (lineNum) => {
    if (!noteText.trim()) return;
    onAddManualNote(file.path, lineNum, noteText.trim());
    setNoteText('');
    setActiveLineForNote(null);
  };

  const copyFullContent = () => {
    navigator.clipboard.writeText(diffData?.head_content || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Mapeia linhas que estão dentro de blocos colapsados
  const isLineHidden = (lineNum) => {
    for (let idx = 0; idx < foldableRanges.length; idx++) {
      const range = foldableRanges[idx];
      const isCollapsed = collapsedBlocks[`range-${idx}`] ?? range.can_collapse;
      if (isCollapsed && lineNum > range.start_line && lineNum <= range.end_line) {
        return true;
      }
    }
    return false;
  };

  const getRangeStartingAt = (lineNum) => {
    for (let idx = 0; idx < foldableRanges.length; idx++) {
      const range = foldableRanges[idx];
      if (range.start_line === lineNum && range.can_collapse) {
        return { range, id: `range-${idx}` };
      }
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-115px)] bg-slate-950 overflow-hidden">
      {/* Barra de Ferramentas do Arquivo */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 gap-3">
        {/* Info do Arquivo */}
        <div className="flex items-center gap-3 truncate">
          <span className="font-mono text-xs font-semibold text-slate-100 truncate">
            {file.path}
          </span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {file.layer}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-emerald-400 font-medium">+{file.added}</span>
            <span className="text-rose-400 font-medium">-{file.deleted}</span>
          </div>
        </div>

        {/* Controles de Visualização e Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dobramento AST */}
          {foldableRanges.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px]">
              <button
                onClick={() => setShowOutline(!showOutline)}
                className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                  showOutline ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white'
                }`}
                title="Mostrar/ocultar índice de classes e funções (AST)"
              >
                <FileCode2 className="w-3 h-3" />
                <span>Escopos ({foldableRanges.length})</span>
              </button>
              <button
                onClick={collapseAllUnchanged}
                className="px-2 py-1 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition"
                title="Colapsa funções e classes que não sofreram alterações"
              >
                Colapsar Inalteradas
              </button>
              <button
                onClick={expandAll}
                className="px-2 py-1 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition"
                title="Expandir todo o código do arquivo atual"
              >
                Expandir Tudo
              </button>
            </div>
          )}

          {/* Toggle Mostrar Linhas Removidas Inline */}
          {!showSideBySide && Object.keys(removedBlocksByLine).length > 0 && (
            <button
              onClick={() => setShowRemovedInline(!showRemovedInline)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition ${
                showRemovedInline
                  ? 'bg-rose-950/40 text-rose-300 border-rose-700/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title="Exibir ou ocultar trechos que foram substituídos/removidos da branch base"
            >
              {showRemovedInline ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Removidas Inline</span>
            </button>
          )}

          {/* Toggle Side-by-Side */}
          <button
            onClick={() => setShowSideBySide(!showSideBySide)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition ${
              showSideBySide
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Comparar lado a lado com a versão da branch base"
          >
            <Split className="w-3.5 h-3.5" />
            <span>{showSideBySide ? 'Visão Arquivo Único' : 'Lado a Lado'}</span>
          </button>

          {/* Copiar código */}
          <button
            onClick={copyFullContent}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            title="Copiar código completo do arquivo atual"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Status do Arquivo no PR */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => onSetStatus(file.path, 'approved')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                fileStatus === 'approved'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aprovar</span>
            </button>
            <button
              onClick={() => onSetStatus(file.path, 'flagged')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                fileStatus === 'flagged'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Flag</span>
            </button>
            <button
              onClick={() => onSetStatus(file.path, 'pending')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                fileStatus === 'pending'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Índice de Escopos Python (AST Outline + Status de Docstring) */}
      {showOutline && foldableRanges.length > 0 && (
        <div className="px-5 py-2 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
            Funções/Classes:
          </span>
          {foldableRanges.map((scope, idx) => {
            const hasDoc = Boolean(scope.docstring && scope.docstring.trim());
            return (
              <button
                key={`outline-${idx}`}
                onClick={() => scrollToLine(scope.start_line, idx)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono flex items-center gap-1.5 shrink-0 border transition ${
                  scope.has_changes
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title={
                  scope.docstring
                    ? `Docstring: ${scope.docstring}`
                    : 'Sem docstring definida nesta função/classe'
                }
              >
                <span>{scope.name}()</span>
                {scope.has_changes && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Alterada neste PR" />
                )}
                {!hasDoc && scope.has_changes && (
                  <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-sans">
                    s/ doc
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Área de Visualização do Código */}
      <div className="flex-1 overflow-auto font-code text-xs leading-relaxed flex">
        {/* Painel Base (se Lado a Lado ativado) */}
        {showSideBySide && (
          <div className="w-1/2 border-r border-slate-800 overflow-auto bg-slate-950/80">
            <div className="sticky top-0 bg-slate-900/90 px-4 py-1.5 border-b border-slate-800 text-[11px] font-sans font-semibold text-slate-400 flex justify-between">
              <span>Versão Base (Antes)</span>
              <span>{baseLines.length} linhas</span>
            </div>
            <div className="py-2">
              {baseLines.map((line, idx) => (
                <div key={`base-${idx}`} className="flex hover:bg-slate-900/50 px-2 py-0.5">
                  <span className="w-10 text-right pr-3 select-none text-slate-600 font-mono text-[11px]">
                    {idx + 1}
                  </span>
                  <pre className="flex-1 overflow-x-auto text-slate-400 whitespace-pre">
                    {line || ' '}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Painel Head (Arquivo Atual Completo com Destaques e Colapso AST) */}
        <div className={`${showSideBySide ? 'w-1/2' : 'w-full'} overflow-auto bg-slate-950`}>
          {showSideBySide && (
            <div className="sticky top-0 bg-slate-900/90 px-4 py-1.5 border-b border-slate-800 text-[11px] font-sans font-semibold text-emerald-400 flex justify-between">
              <span>Versão Proposta Completa (Task Atual)</span>
              <span>{headLines.length} linhas</span>
            </div>
          )}

          <div className="py-2">
            {headLines.map((line, idx) => {
              const lineNum = idx + 1;
              const status = lineStatuses[idx] || 'unchanged';
              const isAdded = status === 'added';
              const isModified = status === 'modified';
              const hidden = isLineHidden(lineNum);
              const removedBeforeThisLine = removedBlocksByLine[String(lineNum)] || [];

              // Verifica se um bloco colapsável inicia nesta linha
              const startRangeInfo = getRangeStartingAt(lineNum);
              if (startRangeInfo) {
                const { range, id } = startRangeInfo;
                const isCollapsed = collapsedBlocks[id] ?? range.can_collapse;
                return (
                  <React.Fragment key={`line-${lineNum}`}>
                    {/* Barra de cabeçalho do bloco AST */}
                    <div
                      ref={(el) => (lineRefs.current[lineNum] = el)}
                      onClick={() => toggleBlockCollapse(id)}
                      className="my-1 mx-3 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between cursor-pointer select-none text-[11px] font-sans text-slate-400 transition"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span className="font-mono text-indigo-300 font-medium">
                          {range.type} {range.name}({range.params?.join(', ')})
                        </span>
                        {range.docstring && (
                          <span className="text-slate-500 text-[10px] truncate max-w-xs">
                            — {range.docstring.split('\n')[0]}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {isCollapsed
                          ? `[${range.end_line - range.start_line + 1} linhas inalteradas colapsadas - clique para expandir]`
                          : `linhas ${range.start_line}..${range.end_line}`}
                      </span>
                    </div>

                    {/* Se não estiver colapsado, renderiza a primeira linha normalmente */}
                    {!isCollapsed && (
                      <div className="flex hover:bg-slate-900/70 px-2 py-0.5 group">
                        <span className="w-12 text-right pr-3 select-none text-slate-600 font-mono text-[11px]">
                          {lineNum}
                        </span>
                        <pre className="flex-1 overflow-x-auto text-slate-200 whitespace-pre">
                          {line || ' '}
                        </pre>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              // Se a linha estiver dentro de um bloco colapsado, oculta
              if (hidden) return null;

              // Achados da IA para esta linha
              const findingsOnLine = (aiFindings || []).filter((f) => f.line === lineNum);
              // Notas manuais para esta linha
              const notesOnLine = (manualNotes || []).filter((n) => n.line === lineNum);

              let bgClass = 'hover:bg-slate-900/50';
              let lineIndicator = null;
              if (isAdded) {
                bgClass = 'bg-emerald-950/20 border-l-2 border-emerald-500 hover:bg-emerald-950/30';
                lineIndicator = '+';
              } else if (isModified) {
                bgClass = 'bg-amber-950/20 border-l-2 border-amber-500 hover:bg-amber-950/30';
                lineIndicator = '~';
              }

              return (
                <div
                  key={`line-${lineNum}`}
                  ref={(el) => (lineRefs.current[lineNum] = el)}
                  className="flex flex-col"
                >
                  {/* Linhas removidas da versão anterior (se ativo) */}
                  {!showSideBySide && showRemovedInline && removedBeforeThisLine.length > 0 && (
                    <div className="bg-rose-950/20 border-l-2 border-rose-600/70 my-0.5">
                      {removedBeforeThisLine.map((remLine, rIdx) => (
                        <div
                          key={`rem-${lineNum}-${rIdx}`}
                          className="flex items-start px-2 py-0.5 text-rose-300/80"
                        >
                          <span className="w-12 shrink-0 text-right pr-3 select-none text-rose-500/60 font-mono text-[10px]">
                            ant
                          </span>
                          <span className="w-4 select-none font-mono text-center text-[10px] text-rose-400">
                            -
                          </span>
                          <pre className="flex-1 overflow-x-auto whitespace-pre font-code line-through decoration-rose-500/40">
                            {remLine || ' '}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Linha de Código Atual */}
                  <div className={`flex items-start px-2 py-0.5 group ${bgClass}`}>
                    {/* Número da Linha + Botão Adicionar Comentário */}
                    <div className="w-12 shrink-0 flex items-center justify-between pr-2 select-none text-slate-600 font-mono text-[11px]">
                      <span>{lineNum}</span>
                      <button
                        onClick={() => setActiveLineForNote(activeLineForNote === lineNum ? null : lineNum)}
                        className="opacity-0 group-hover:opacity-100 hover:text-indigo-400 transition"
                        title="Adicionar anotação manual para o prompt do Claude"
                      >
                        <PlusCircle className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Indicador de Alteração */}
                    <span className="w-4 select-none font-mono text-center text-[10px] text-slate-500">
                      {lineIndicator}
                    </span>

                    {/* Conteúdo do Código */}
                    <pre className="flex-1 overflow-x-auto text-slate-200 whitespace-pre font-code">
                      {line || ' '}
                    </pre>
                  </div>

                  {/* Input para Adicionar Nota Manual */}
                  {activeLineForNote === lineNum && (
                    <div className="mx-14 my-1.5 p-2.5 bg-slate-900 border border-indigo-500/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-sans text-indigo-300">
                        <span>Anotação para a Linha {lineNum} (será incluída no Prompt do Claude):</span>
                        <button
                          onClick={() => setActiveLineForNote(null)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          ✕
                        </button>
                      </div>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Ex.: Trocar por injeção de dependência e validar se o schema está correto..."
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 outline-none font-sans"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveManualNote(lineNum)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-sans font-medium"
                        >
                          Salvar Anotação
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notas Manuais Já Criadas */}
                  {notesOnLine.map((note, nIdx) => (
                    <div
                      key={`manual-${nIdx}`}
                      className="mx-14 my-1 p-2 bg-purple-950/30 border border-purple-500/30 rounded-lg text-xs font-sans flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <strong className="text-purple-300 text-[11px] block">Sua observação:</strong>
                          <p className="text-slate-200">{note.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Anotações da IA para a Linha */}
                  {findingsOnLine.map((issue, iIdx) => {
                    const isError = issue.severity === 'error';
                    const isWarn = issue.severity === 'warning';
                    const badgeClass = isError
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : isWarn
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                    return (
                      <div
                        key={`ai-${iIdx}`}
                        className="mx-14 my-1.5 p-3 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg text-xs font-sans space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
                              {issue.lens} • {issue.severity}
                            </span>
                            <span className="font-semibold text-slate-100">{issue.title}</span>
                          </div>
                          <button
                            onClick={() => onAddNoteToClaudePrompt(file.path, issue)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-[11px] font-medium transition"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Adicionar ao Prompt</span>
                          </button>
                        </div>

                        <p className="text-slate-300 text-[12px]">{issue.description}</p>

                        {issue.suggested_fix && (
                          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                            <span className="text-[10px] uppercase font-sans text-slate-500 block mb-1">
                              Sugestão de Correção:
                            </span>
                            <pre className="whitespace-pre">{issue.suggested_fix}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
