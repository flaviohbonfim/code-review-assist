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
import { testGeminiConnection } from '../api';

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
  const [testingKey, setTestingKey] = useState(false);
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

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGeminiConnection(geminiApiKey);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestingKey(false);
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
              onChange={(e) => setAiProvider(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="claude" className="bg-slate-900 text-slate-200">Claude CLI (Local)</option>
              <option value="gemini" className="bg-slate-900 text-slate-200">Google Gemini API</option>
            </select>
          </div>

          {aiProvider === 'gemini' && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 border rounded-lg transition ${
                showConfig
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
              title="Configurar e testar Chave da API Gemini"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Configuração da Chave Gemini */}
      {showConfig && aiProvider === 'gemini' && (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testingKey}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition disabled:opacity-50"
                title="Envia requisição rápida para testar se a chave responde sem timeout"
              >
                {testingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{testingKey ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                onClick={() => setShowConfig(false)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Resultado do Teste da Conexão */}
          {testResult && (
            <div className={`p-2 rounded-lg text-xs font-mono border flex items-start gap-2 ${
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
                      Conexão com Google AI Studio OK ({testResult.elapsed_seconds}s)!
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Total de modelos na sua conta: <strong>{testResult.total_models}</strong>. Modelos Flash disponíveis: {testResult.flash_models?.join(', ') || 'nenhum'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold font-sans text-rose-200">Falha no teste de conexão:</p>
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
