import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Zap
} from 'lucide-react';

export default function FileTree({
  layers,
  selectedFile,
  onSelectFile,
  fileStatuses,
  onToggleStatus
}) {
  const [filterType, setFilterType] = useState('all'); // all, logic, noise, pending, approved, flagged
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedLayers, setCollapsedLayers] = useState({});

  const toggleLayer = (layerName) => {
    setCollapsedLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  const getStatusIcon = (filePath) => {
    const status = fileStatuses[filePath] || 'pending';
    if (status === 'approved') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Aprovado" />;
    }
    if (status === 'flagged') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" title="Com pendências" />;
    }
    return <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" title="Pendente de revisão" />;
  };

  const matchesFilter = (file) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!file.path.toLowerCase().includes(term) && !file.filename.toLowerCase().includes(term)) {
        return false;
      }
    }

    const status = fileStatuses[file.path] || 'pending';
    if (filterType === 'logic') return !file.is_mechanical_noise;
    if (filterType === 'noise') return file.is_mechanical_noise;
    if (filterType === 'pending') return status === 'pending';
    if (filterType === 'approved') return status === 'approved';
    if (filterType === 'flagged') return status === 'flagged';
    return true;
  };

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col h-[calc(100vh-65px)] select-none">
      {/* Busca e Filtros Rápidos */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar arquivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50 transition font-mono"
          />
        </div>

        {/* Pílulas de filtro */}
        <div className="flex flex-wrap gap-1 text-[11px]">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'logic', label: 'Lógica', icon: Zap },
            { id: 'noise', label: 'Ruído' },
            { id: 'pending', label: 'Pendentes' },
            { id: 'approved', label: 'Aprovados' },
            { id: 'flagged', label: 'Flags' }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition ${
                  active
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {Icon && <Icon className="w-2.5 h-2.5" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Árvore de Arquivos Agrupada por Camada */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(layers).map(([layerName, files]) => {
          const filteredFiles = files.filter(matchesFilter);
          if (filteredFiles.length === 0) return null;
          const isCollapsed = collapsedLayers[layerName];

          return (
            <div key={layerName} className="space-y-1">
              {/* Header da Camada */}
              <button
                onClick={() => toggleLayer(layerName)}
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white rounded hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className="truncate">{layerName}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                  {filteredFiles.length}
                </span>
              </button>

              {/* Lista de Arquivos da Camada */}
              {!isCollapsed && (
                <div className="space-y-0.5 pl-2">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFile?.path === file.path;
                    return (
                      <div
                        key={file.path}
                        onClick={() => onSelectFile(file)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          {getStatusIcon(file.path)}
                          <span className="truncate font-mono text-[11px]" title={file.path}>
                            {file.filename}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {file.is_mechanical_noise && (
                            <span className="text-[9px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                              Ruído
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-emerald-400">+{file.added}</span>
                          <span className="text-[10px] font-mono text-rose-400">-{file.deleted}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
