import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileTree from './components/FileTree';
import CodeViewer from './components/CodeViewer';
import ReviewLensesBar from './components/ReviewLensesBar';
import DependencyGraph from './components/DependencyGraph';
import ClaudePromptModal from './components/ClaudePromptModal';
import PRWalkthroughModal from './components/PRWalkthroughModal';
import {
  listBranches,
  compareBranches,
  getFileDiff,
  runAIReview,
  generateClaudePrompt,
  selectFolderViaFinder,
  explainPR
} from './api';

export default function App() {
  const [repoPath, setRepoPath] = useState('/Users/flavim/gemini/code-review-assist');
  const [branches, setBranches] = useState([]);
  const [baseBranch, setBaseBranch] = useState('main');
  const [headBranch, setHeadBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Dados do Compare
  const [compareData, setCompareData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Status de Revisão por Arquivo: 'pending' | 'approved' | 'flagged'
  const [fileStatuses, setFileStatuses] = useState({});

  // Anotações da IA e Notas Manuais
  const [aiFindingsByFile, setAiFindingsByFile] = useState({});
  const [manualNotesByFile, setManualNotesByFile] = useState({});
  const [allReviewNotes, setAllReviewNotes] = useState([]);

  // IA Lenses
  const [aiProvider, setAiProvider] = useState('antigravity'); // 'antigravity' | 'claude' | 'gemini'
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [loadingLens, setLoadingLens] = useState(false);
  const [currentLens, setCurrentLens] = useState(null);

  // Modais
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [generatedPromptText, setGeneratedPromptText] = useState('');

  // Visualização Ativa Principal: 'code' | 'walkthrough'
  const [activeMainView, setActiveMainView] = useState('code');
  const [walkthroughData, setWalkthroughData] = useState(null);
  const [loadingWalkthrough, setLoadingWalkthrough] = useState(false);

  // Carrega branches ao iniciar se repoPath estiver preenchido
  useEffect(() => {
    if (repoPath) {
      handleLoadBranches();
    }
  }, []);

  const handleSelectFolderViaFinder = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await selectFolderViaFinder();
      if (data.cancelled) {
        setLoading(false);
        return;
      }
      setRepoPath(data.path);
      setBranches(data.branches || []);
      if (data.branches?.length > 0) {
        setBaseBranch(data.branches[0] || 'main');
        setHeadBranch(data.branches[1] || data.branches[0] || 'main');
      }
      setCompareData(null);
      setSelectedFile(null);
      setDiffData(null);
      setWalkthroughData(null);
    } catch (err) {
      setErrorMessage(`Erro ao selecionar pasta no Finder: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBranches = async () => {
    if (!repoPath || !repoPath.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await listBranches(repoPath.trim());
      setBranches(data.branches || []);
      if (data.branches?.length > 0) {
        setBaseBranch(data.branches[0] || 'main');
        setHeadBranch(data.branches[1] || data.branches[0] || 'main');
      }
    } catch (err) {
      setErrorMessage(`Erro ao carregar branches: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!baseBranch || !headBranch) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await compareBranches(repoPath, baseBranch, headBranch);
      setCompareData(data);
      setWalkthroughData(null);
      setActiveMainView('code');
      // Seleciona o primeiro arquivo da lista se houver
      const firstFile = data.summary?.all_files?.[0];
      if (firstFile) {
        handleSelectFile(firstFile);
      } else {
        setSelectedFile(null);
        setDiffData(null);
      }
    } catch (err) {
      setErrorMessage(`Erro ao comparar branches: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (file) => {
    setSelectedFile(file);
    setActiveMainView('code');
    setLoadingDiff(true);
    setErrorMessage(null);
    try {
      const diff = await getFileDiff(repoPath, baseBranch, headBranch, file.path);
      setDiffData(diff);
    } catch (err) {
      setErrorMessage(`Erro ao carregar diff de ${file.filename}: ${err.message}`);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleSetFileStatus = (filePath, status) => {
    setFileStatuses((prev) => ({
      ...prev,
      [filePath]: status
    }));
  };

  const handleRunLens = async (lensId) => {
    if (!selectedFile || !diffData) return;
    setLoadingLens(true);
    setCurrentLens(lensId);
    setErrorMessage(null);

    const codeToAnalyze = diffData.head_content || '';
    try {
      const result = await runAIReview(
        codeToAnalyze,
        lensId,
        selectedFile.path,
        aiProvider,
        geminiApiKey
      );

      if (result.error) {
        setErrorMessage(result.error);
      }

      if (result.issues && result.issues.length > 0) {
        setAiFindingsByFile((prev) => ({
          ...prev,
          [selectedFile.path]: [
            ...(prev[selectedFile.path] || []).filter((i) => i.lens !== lensId),
            ...result.issues
          ]
        }));
      }
    } catch (err) {
      setErrorMessage(`Erro na lente ${lensId}: ${err.message}`);
    } finally {
      setLoadingLens(false);
      setCurrentLens(null);
    }
  };

  const handleOpenWalkthrough = async () => {
    if (!compareData) {
      setErrorMessage('Por favor, compare as branches antes de solicitar o walkthrough da task.');
      return;
    }
    setActiveMainView('walkthrough');
    if (walkthroughData) return; // Já foi carregado para esta comparação

    setLoadingWalkthrough(true);
    setErrorMessage(null);
    try {
      const res = await explainPR(
        repoPath,
        baseBranch,
        headBranch,
        aiProvider,
        geminiApiKey
      );
      setWalkthroughData(res);
      if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage(`Erro ao gerar explicação do PR: ${err.message}`);
    } finally {
      setLoadingWalkthrough(false);
    }
  };

  const handleReloadWalkthrough = async () => {
    setLoadingWalkthrough(true);
    setErrorMessage(null);
    try {
      const res = await explainPR(
        repoPath,
        baseBranch,
        headBranch,
        aiProvider,
        geminiApiKey
      );
      setWalkthroughData(res);
      if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage(`Erro ao gerar explicação do PR: ${err.message}`);
    } finally {
      setLoadingWalkthrough(false);
    }
  };

  const handleSelectFileFromWalkthrough = (filePath) => {
    const allFiles = compareData?.summary?.all_files || [];
    let found = allFiles.find((f) => f.path === filePath);
    if (!found) {
      found = {
        path: filePath,
        filename: filePath.split('/').pop(),
        status: 'modified'
      };
    }
    handleSelectFile(found);
  };

  const handleAddManualNote = (filePath, line, description) => {
    const newNote = {
      file_path: filePath,
      line: line,
      severity: 'warning',
      title: 'Observação do Desenvolvedor',
      description: description,
      suggested_fix: ''
    };

    setManualNotesByFile((prev) => ({
      ...prev,
      [filePath]: [...(prev[filePath] || []), newNote]
    }));

    setAllReviewNotes((prev) => [...prev, newNote]);
    handleSetFileStatus(filePath, 'flagged');
  };

  const handleAddNoteToClaudePrompt = (filePath, issue) => {
    const note = {
      file_path: filePath,
      line: issue.line,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      suggested_fix: issue.suggested_fix
    };
    setAllReviewNotes((prev) => [...prev, note]);
    handleSetFileStatus(filePath, 'flagged');
  };

  const handleOpenClaudePromptModal = async () => {
    try {
      const repoName = compareData?.repo_name || 'Projeto';
      const res = await generateClaudePrompt(
        repoName,
        baseBranch,
        headBranch,
        allReviewNotes
      );
      setGeneratedPromptText(res.prompt);
      setIsPromptModalOpen(true);
    } catch (err) {
      setErrorMessage(`Erro ao gerar prompt para Claude: ${err.message}`);
    }
  };

  // Cálculo de Progresso
  const totalFiles = compareData?.summary?.total_files || 0;
  const reviewedCount = Object.values(fileStatuses).filter(
    (s) => s === 'approved' || s === 'flagged'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header com Navegação de Repositório e Branches */}
      <Header
        repoPath={repoPath}
        setRepoPath={setRepoPath}
        branches={branches}
        baseBranch={baseBranch}
        setBaseBranch={setBaseBranch}
        headBranch={headBranch}
        setHeadBranch={setHeadBranch}
        onLoadBranches={handleLoadBranches}
        onSelectFolderViaFinder={handleSelectFolderViaFinder}
        onCompare={handleCompare}
        summary={compareData?.summary}
        loading={loading}
        progress={{ reviewed: reviewedCount, total: totalFiles }}
        onOpenGraph={() => setIsGraphOpen(true)}
        onOpenClaudePrompt={handleOpenClaudePromptModal}
        onOpenWalkthrough={handleOpenWalkthrough}
        activeMainView={activeMainView}
        setActiveMainView={setActiveMainView}
      />

      {/* Alerta de Erro se houver */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-6 py-2 text-xs text-rose-200 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Lentes de Avaliação com 1-Clique */}
      <ReviewLensesBar
        onRunLens={handleRunLens}
        loadingLens={loadingLens}
        currentLens={currentLens}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        geminiApiKey={geminiApiKey}
        setGeminiApiKey={setGeminiApiKey}
        selectedFile={selectedFile}
      />

      {/* Área Principal: Abas Código & Diff vs Walkthrough da Task */}
      <main className="flex-1 flex overflow-hidden">
        {activeMainView === 'walkthrough' ? (
          <PRWalkthroughModal
            mode="fullpage"
            isOpen={true}
            data={walkthroughData}
            loading={loadingWalkthrough}
            onSelectFile={(filePath) => {
              handleSelectFileFromWalkthrough(filePath);
              setActiveMainView('code');
            }}
            onReload={handleReloadWalkthrough}
            repoPath={repoPath}
            baseBranch={baseBranch}
            headBranch={headBranch}
          />
        ) : compareData?.summary?.layers ? (
          <>
            <FileTree
              layers={compareData.summary.layers}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              fileStatuses={fileStatuses}
              onToggleStatus={handleSetFileStatus}
            />
            <CodeViewer
              file={selectedFile}
              diffData={diffData}
              loadingDiff={loadingDiff}
              aiFindings={selectedFile ? aiFindingsByFile[selectedFile.path] || [] : []}
              manualNotes={selectedFile ? manualNotesByFile[selectedFile.path] || [] : []}
              onAddManualNote={handleAddManualNote}
              onAddNoteToClaudePrompt={handleAddNoteToClaudePrompt}
              fileStatus={selectedFile ? fileStatuses[selectedFile.path] || 'pending' : 'pending'}
              onSetStatus={handleSetFileStatus}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 shadow-xl shadow-indigo-500/5">
              <span className="text-2xl font-bold">CR</span>
            </div>
            <h2 className="text-base font-semibold text-slate-300 mb-1">
              Pronto para iniciar a revisão de código
            </h2>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              Clique em <strong>Finder...</strong> para escolher a pasta do repositório no seu Mac (ou cole o caminho no campo), selecione a <strong>branch base</strong> e a <strong>branch da task</strong>, e clique em <strong>Comparar</strong>.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectFolderViaFinder}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center gap-2"
              >
                <span>Selecionar Pasta no Finder</span>
              </button>
              <button
                onClick={handleCompare}
                disabled={loading || branches.length === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                {loading ? 'Comparando branches...' : 'Comparar Branches Agora'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Mapa Arquitetural do PR */}
      <DependencyGraph
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
        summary={compareData?.summary}
        graph={compareData?.graph}
        onSelectFile={handleSelectFile}
      />

      {/* Modal: Prompt Estruturado para o Claude Code */}
      <ClaudePromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        promptText={generatedPromptText}
        reviewNotes={allReviewNotes}
        onClearNotes={() => setAllReviewNotes([])}
      />
    </div>
  );
}
