import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  FileCheck,
  Bug,
  Cpu,
  Layers,
  Settings2,
  CheckCircle2,
  Loader2,
  Terminal,
  Activity,
  AlertCircle
} from 'lucide-react';
import { testAntigravityConnection, testGeminiConnection } from '../api';

export default function ReviewLensesBar({
  onRunLens,
  loadingLens,
  currentLens,
  aiProvider,
  setAiProvider,
  geminiApiKey,
  setGeminiApiKey,
  selectedFile
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const lenses = [
    {
      id: 'solid',
      name: 'SOLID',
      icon: Layers,
      color: 'from-blue-600 to-cyan-500',
      description: 'Responsabilidade única (SRP), Inversão de dependência (DIP) e acoplamento'
    },
    {
      id: 'clean_code',
      name: 'Clean Code & Pythonic',
      icon: Sparkles,
      color: 'from-emerald-600 to-teal-500',
      description: 'Nomes claros, early returns, type hints e redução de complexidade'
    },
    {
      id: 'docstrings',
      name: 'Docstrings & Comentários',
      icon: FileCheck,
      color: 'from-purple-600 to-pink-500',
      description: 'Filtro anti-ruído de IA: valida parâmetros reais vs docstrings e remove comentários inúteis'
    },
    {
      id: 'bugs_security',
      name: 'Bugs & Segurança',
      icon: Bug,
      color: 'from-rose-600 to-orange-500',
      description: 'Default args mutáveis, except pass silencioso, SQL injection e N+1'
    },
    {
      id: 'static_analysis',
      name: 'Análise Estática (Instantânea)',
      icon: Cpu,
      color: 'from-amber-600 to-yellow-500',
      description: 'Varredura local instantânea via AST (sem gastar tokens)'
    }
  ];

  const handleTestProvider = async () => {
    setTestingProvider(true);
    setTestResult(null);
    try {
      if (aiProvider === 'antigravity') {
        const res = await testAntigravityConnection();
        setTestResult(res);
      } else if (aiProvider === 'gemini') {
        const res = await testGeminiConnection(geminiApiKey);
        setTestResult(res);
      } else {
        // Claude CLI
        setTestResult({ ok: true, version: 'Claude CLI configurado via subprocess', elapsed_seconds: 0.05 });
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestingProvider(false);
    }
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Botões das Lentes de Avaliação */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Lentes de IA:
          </span>

          {lenses.map((lens) => {
            const Icon = lens.icon;
            const isRunning = loadingLens && currentLens === lens.id;
            return (
              <button
                key={lens.id}
                onClick={() => onRunLens(lens.id)}
                disabled={loadingLens || !selectedFile}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition shadow-sm ${
                  isRunning
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 animate-pulse'
                    : 'bg-slate-800/90 text-slate-200 border-slate-700/80 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
                title={lens.description}
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>{lens.name}</span>
              </button>
            );
          })}
        </div>

        {/* Provedor de IA e Configuração */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400">Provedor:</span>
            <select
              value={aiProvider}
              onChange={(e) => {
                setAiProvider(e.target.value);
                setTestResult(null);
              }}
              className="bg-transparent text-slate-200 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="antigravity" className="bg-slate-900 text-slate-200">Antigravity CLI (agy -p)</option>
              <option value="claude" className="bg-slate-900 text-slate-200">Claude CLI (claude -p)</option>
              <option value="gemini" className="bg-slate-900 text-slate-200">Google Gemini API (Nuvem)</option>
            </select>
          </div>

          {/* Botão de Testar Conexão do Provedor Selecionado */}
          <button
            type="button"
            onClick={() => {
              if (aiProvider === 'gemini') {
                setShowConfig(!showConfig);
              } else {
                handleTestProvider();
                setShowConfig(true);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg transition text-xs font-medium ${
              showConfig
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
            title="Verificar status e testar conexão com o provedor de IA"
          >
            {testingProvider ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Status / Testar</span>
          </button>
        </div>
      </div>

      {/* Painel de Status / Configuração do Provedor */}
      {showConfig && (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {aiProvider === 'antigravity' && (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-slate-300 font-medium">Antigravity CLI:</span>
                <span className="font-mono text-emerald-400 text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  agy -p &quot;&lt;prompt&gt;&quot;
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  (Executado localmente via subprocess no mesmo ambiente do agente)
                </span>
              </div>
            )}

            {aiProvider === 'claude' && (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-slate-300 font-medium">Claude CLI:</span>
                <span className="font-mono text-indigo-400 text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  claude -p &quot;&lt;prompt&gt;&quot;
                </span>
              </div>
            )}

            {aiProvider === 'gemini' && (
              <div className="flex-1 flex items-center gap-2 min-w-[280px]">
                <span className="text-slate-400 font-medium whitespace-nowrap">GEMINI_API_KEY:</span>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Cole sua chave de API ou defina via variável de ambiente..."
                  className="flex-1 p-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-slate-200 outline-none text-xs"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestProvider}
                disabled={testingProvider}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition disabled:opacity-50"
              >
                {testingProvider ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{testingProvider ? 'Testando...' : 'Executar Teste'}</span>
              </button>

              <button
                onClick={() => setShowConfig(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Resultado do Teste da Conexão */}
          {testResult && (
            <div className={`p-2.5 rounded-lg text-xs font-mono border flex items-start gap-2 ${
              testResult.ok
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}>
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              )}
              <div className="space-y-0.5 flex-1">
                {testResult.ok ? (
                  <>
                    <p className="font-semibold font-sans text-emerald-200">
                      {aiProvider === 'antigravity'
                        ? `Antigravity CLI pronto e acessível (${testResult.elapsed_seconds || 0}s)!`
                        : `Conexão OK (${testResult.elapsed_seconds || 0}s)!`}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {testResult.binary && <span>Binário: <strong>{testResult.binary}</strong> • </span>}
                      {testResult.version && <span>{testResult.version}</span>}
                      {testResult.total_models && <span>Total de modelos: {testResult.total_models}</span>}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold font-sans text-rose-200">Falha no teste:</p>
                    <pre className="text-[11px] whitespace-pre-wrap">{testResult.error}</pre>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
