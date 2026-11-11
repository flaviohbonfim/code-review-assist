/**
 * Exporta o Walkthrough & Auditoria Sênior como um HTML standalone auto-contido.
 * O documento gerado inclui todos os estilos inline, sem dependências externas.
 */
export function exportWalkthroughHTML(data, repoName, baseBranch, headBranch) {
  if (!data) return;

  const stats = data.stats || {};
  const addedFiles = data.all_added_files || [];
  const modifiedFiles = data.all_modified_files || [];
  const newAnalysis = data.new_files_analysis || [];
  const modAnalysis = data.modified_files_analysis || [];
  const audit = data.senior_audit || {};
  const capabilities = data.new_capabilities || [];
  const timestamp = new Date().toLocaleString('pt-BR');

  // Mapa de análises por path
  const newMap = {};
  newAnalysis.forEach(a => { if (a.path) newMap[a.path] = a; });
  const modMap = {};
  modAnalysis.forEach(a => { if (a.path) modMap[a.path] = a; });

  const escHTML = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const renderFileCard = (file, analysis, type) => {
    const badge = type === 'added'
      ? '<span class="badge badge-added">NOVO ARQUIVO</span>'
      : '<span class="badge badge-modified">MODIFICADO</span>';
    const layerBadge = file.layer ? `<span class="badge badge-layer">${escHTML(file.layer)}</span>` : '';
    const linesInfo = type === 'added'
      ? `<span class="lines-added">+${file.added || 0} linhas</span>`
      : `<span class="lines-added">+${file.added || 0}</span> / <span class="lines-deleted">-${file.deleted || 0}</span>`;

    let detailsHTML = '';
    if (analysis) {
      if (analysis.purpose) {
        detailsHTML += `<div class="detail-block"><strong class="detail-label">Papel no Sistema:</strong><p>${escHTML(analysis.purpose)}</p></div>`;
      }
      if (type === 'added') {
        detailsHTML += `
          <div class="audit-grid">
            <div class="audit-card audit-solid">
              <strong>Princípios SOLID</strong>
              <span class="audit-rating">${escHTML(analysis.solid_rating || 'OK')}</span>
              <p>${escHTML(analysis.solid_comment || 'Sem violação observada.')}</p>
            </div>
            <div class="audit-card audit-clean">
              <strong>Clean Code & PEP 8</strong>
              <span class="audit-rating">${escHTML(analysis.clean_code_rating || 'Bom')}</span>
              <p>${escHTML(analysis.clean_code_comment || 'Código limpo e legível.')}</p>
            </div>
            <div class="audit-card audit-yagni">
              <strong>YAGNI / Simplicidade</strong>
              <span class="audit-rating">${escHTML(analysis.yagni_rating || 'Pragmático')}</span>
              <p>${escHTML(analysis.yagni_comment || 'Sem overengineering detectado.')}</p>
            </div>
          </div>`;
        if (analysis.code_highlights) {
          detailsHTML += `<div class="detail-block code-block"><strong class="detail-label">Alterações de Código:</strong><pre>${escHTML(analysis.code_highlights)}</pre></div>`;
        }
        if (analysis.senior_recommendation) {
          detailsHTML += `<div class="recommendation">💡 <strong>Recomendação Sênior:</strong> ${escHTML(analysis.senior_recommendation)}</div>`;
        }
      } else {
        if (analysis.changes_summary) {
          detailsHTML += `<div class="detail-block code-block"><strong class="detail-label">O Que Mudou:</strong><pre>${escHTML(analysis.changes_summary)}</pre></div>`;
        }
        if (analysis.regression_risk || analysis.regression_notes) {
          detailsHTML += `<div class="risk-block"><strong>Risco de Regressão:</strong> <span class="risk-badge risk-${(analysis.regression_risk||'baixo').toLowerCase()}">${escHTML(analysis.regression_risk || 'Baixo')}</span>${analysis.regression_notes ? ` — ${escHTML(analysis.regression_notes)}` : ''}</div>`;
        }
      }
    } else {
      detailsHTML = `<p class="no-analysis">Arquivo ${type === 'added' ? 'registrado no commit' : 'modificado na task'}. Sem análise detalhada da IA para este arquivo.</p>`;
    }

    return `
      <div class="file-card">
        <div class="file-header">
          <div class="file-badges">${badge}${layerBadge}<span class="file-path">${escHTML(file.path)}</span></div>
          <div class="file-lines">${linesInfo}</div>
        </div>
        ${detailsHTML}
      </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Walkthrough & Auditoria — ${escHTML(repoName)} (${escHTML(headBranch)})</title>
  <style>
    :root {
      --bg-900: #0f172a; --bg-950: #020617; --bg-800: #1e293b;
      --text-100: #f1f5f9; --text-200: #e2e8f0; --text-300: #cbd5e1;
      --text-400: #94a3b8; --text-500: #64748b;
      --indigo: #818cf8; --emerald: #34d399; --amber: #fbbf24;
      --purple: #a78bfa; --rose: #fb7185; --blue: #60a5fa;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg-950); color: var(--text-200); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
    h1 { font-size: 20px; color: var(--text-100); margin-bottom: 4px; }
    h2 { font-size: 16px; color: var(--text-100); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    h3 { font-size: 14px; color: var(--text-100); margin-bottom: 8px; }
    .subtitle { font-size: 12px; color: var(--text-500); margin-bottom: 24px; }
    .header-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 20px; background: var(--bg-900); border: 1px solid #334155; border-radius: 16px; margin-bottom: 20px; }
    .header-meta { font-size: 11px; color: var(--text-500); font-family: monospace; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .metric-card { padding: 14px; background: var(--bg-950); border: 1px solid #334155; border-radius: 12px; }
    .metric-label { display: block; font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-500); letter-spacing: 0.05em; }
    .metric-value { font-size: 22px; font-weight: 700; font-family: monospace; color: var(--text-200); }
    .metric-value.green { color: var(--emerald); }
    .metric-value.amber { color: var(--amber); }
    .section { margin-bottom: 28px; }
    .section-block { padding: 20px; background: var(--bg-900); border: 1px solid #334155; border-radius: 12px; margin-bottom: 16px; }
    .section-block.highlight { background: linear-gradient(135deg, rgba(99,102,241,0.08), var(--bg-900)); border-color: rgba(99,102,241,0.25); }
    .section-block.purple-highlight { background: linear-gradient(135deg, rgba(139,92,246,0.08), var(--bg-900)); border-color: rgba(139,92,246,0.25); }
    .capability-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .capability-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-950); border: 1px solid rgba(99,102,241,0.25); border-radius: 8px; font-size: 12px; color: #c7d2fe; }
    .capability-chip::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--indigo); }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-added { background: rgba(16,185,129,0.1); color: var(--emerald); border: 1px solid rgba(16,185,129,0.2); }
    .badge-modified { background: rgba(245,158,11,0.1); color: var(--amber); border: 1px solid rgba(245,158,11,0.2); }
    .badge-layer { background: var(--bg-900); color: var(--text-400); border: 1px solid #334155; margin-left: 4px; }
    .file-card { padding: 16px; background: var(--bg-950); border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px; }
    .file-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid rgba(51,65,85,0.6); margin-bottom: 12px; }
    .file-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .file-path { font-family: monospace; font-size: 12px; font-weight: 600; color: var(--text-200); }
    .file-lines { font-family: monospace; font-size: 11px; color: var(--text-400); }
    .lines-added { color: var(--emerald); }
    .lines-deleted { color: var(--rose); }
    .detail-block { margin-bottom: 10px; }
    .detail-label { display: block; font-size: 11px; color: var(--text-400); margin-bottom: 3px; }
    .detail-block p { font-size: 12px; color: var(--text-300); }
    .code-block pre { font-family: monospace; font-size: 11px; color: var(--text-300); white-space: pre-wrap; word-break: break-all; background: rgba(15,23,42,0.6); padding: 10px; border-radius: 6px; border: 1px solid #334155; margin-top: 4px; }
    .audit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 10px 0; }
    .audit-card { padding: 10px; background: rgba(15,23,42,0.7); border-radius: 8px; border: 1px solid rgba(51,65,85,0.7); }
    .audit-card strong { display: block; font-size: 11px; margin-bottom: 4px; }
    .audit-card .audit-rating { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: rgba(99,102,241,0.15); color: var(--indigo); margin-bottom: 4px; }
    .audit-card p { font-size: 11px; color: var(--text-400); line-height: 1.5; }
    .audit-solid strong { color: var(--indigo); }
    .audit-clean strong { color: var(--blue); }
    .audit-yagni strong { color: var(--emerald); }
    .recommendation { font-size: 11px; padding: 8px 12px; background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; color: #c7d2fe; margin-top: 8px; }
    .risk-block { font-size: 11px; color: var(--text-400); margin-top: 8px; }
    .risk-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-weight: 600; font-size: 10px; }
    .risk-baixo { background: rgba(16,185,129,0.15); color: var(--emerald); }
    .risk-médio, .risk-medio { background: rgba(245,158,11,0.15); color: var(--amber); }
    .risk-alto { background: rgba(239,68,68,0.15); color: var(--rose); }
    .no-analysis { font-size: 11px; color: var(--text-500); font-style: italic; }
    .quality-gate-item { padding: 16px; background: var(--bg-950); border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px; }
    .quality-gate-item .qg-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .quality-gate-item .qg-header h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; color: var(--text-200); display: flex; align-items: center; gap: 8px; }
    .quality-gate-item .qg-header h4 .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
    .quality-gate-item .qg-tag { font-size: 10px; font-family: monospace; text-transform: uppercase; }
    .quality-gate-item p { font-size: 12px; color: var(--text-300); white-space: pre-line; line-height: 1.7; }
    .toc { margin: 16px 0 24px; padding: 12px 16px; background: var(--bg-900); border: 1px solid #334155; border-radius: 10px; }
    .toc a { display: inline-block; margin: 3px 8px 3px 0; font-size: 11px; color: var(--indigo); text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .filter-bar { margin-bottom: 12px; }
    .filter-bar input { width: 100%; padding: 8px 12px; background: var(--bg-900); border: 1px solid #334155; border-radius: 8px; color: var(--text-200); font-size: 12px; outline: none; }
    .filter-bar input:focus { border-color: var(--indigo); }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: var(--text-500); border-top: 1px solid #334155; margin-top: 32px; }
    @media print {
      body { background: #fff; color: #1e293b; }
      .container { max-width: 100%; }
      .file-card, .section-block, .quality-gate-item, .metric-card { break-inside: avoid; border-color: #e2e8f0; }
      .filter-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <h1>📖 Walkthrough Técnico & Auditoria de PR</h1>
        <p class="subtitle">História da task contada via código com auditoria em SOLID, Clean Code e YAGNI</p>
      </div>
      <div class="header-meta">
        <div><strong>Repositório:</strong> ${escHTML(repoName)}</div>
        <div><strong>Branches:</strong> ${escHTML(baseBranch)} ← ${escHTML(headBranch)}</div>
        <div><strong>Gerado em:</strong> ${timestamp}</div>
      </div>
    </div>

    <div class="metrics">
      <div class="metric-card"><span class="metric-label">Total de Arquivos</span><span class="metric-value">${stats.total_files || (addedFiles.length + modifiedFiles.length)}</span></div>
      <div class="metric-card"><span class="metric-label">Arquivos Novos</span><span class="metric-value green">+${stats.total_added || addedFiles.length}</span></div>
      <div class="metric-card"><span class="metric-label">Modificados</span><span class="metric-value amber">~${stats.total_modified || modifiedFiles.length}</span></div>
      <div class="metric-card"><span class="metric-label">Linhas Alteradas</span><span class="metric-value"><span class="lines-added">+${stats.total_lines_added || 0}</span> / <span class="lines-deleted">-${stats.total_lines_deleted || 0}</span></span></div>
    </div>

    <div class="toc">
      <strong style="font-size:11px;color:${`var(--text-400)`}">Navegação Rápida:</strong>
      <a href="#resumo">Resumo Executivo</a>
      <a href="#arquitetura">Fluxo Arquitetural</a>
      <a href="#novos">Novos Arquivos (${addedFiles.length})</a>
      <a href="#modificados">Arquivos Modificados (${modifiedFiles.length})</a>
      <a href="#auditoria">Auditoria Sênior</a>
    </div>

    <!-- Resumo Executivo -->
    <div class="section" id="resumo">
      <h2>✨ Resumo Executivo da Entrega</h2>
      <div class="section-block highlight">
        <p>${escHTML(data.executive_summary || 'Resumo não disponível.')}</p>
        ${capabilities.length > 0 ? `
          <div class="capability-list">
            ${capabilities.map(c => `<span class="capability-chip">${escHTML(c)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Fluxo Arquitetural -->
    ${data.architectural_story ? `
    <div class="section" id="arquitetura">
      <h2>🔗 Fluxo Arquitetural Entre as Peças</h2>
      <div class="section-block">
        <p style="white-space:pre-line">${escHTML(data.architectural_story)}</p>
      </div>
    </div>
    ` : ''}

    <!-- Novos Arquivos -->
    <div class="section" id="novos">
      <h2>📄 Novos Arquivos <span style="font-size:12px;color:var(--emerald);font-family:monospace">(${addedFiles.length})</span></h2>
      <div class="filter-bar"><input type="text" placeholder="Filtrar novos arquivos por caminho..." onkeyup="filterCards(this, 'new-files-list')"></div>
      <div id="new-files-list">
        ${addedFiles.map(f => renderFileCard(f, newMap[f.path], 'added')).join('')}
      </div>
    </div>

    <!-- Arquivos Modificados -->
    <div class="section" id="modificados">
      <h2>📝 Arquivos Modificados <span style="font-size:12px;color:var(--amber);font-family:monospace">(${modifiedFiles.length})</span></h2>
      <div class="filter-bar"><input type="text" placeholder="Filtrar arquivos modificados por caminho..." onkeyup="filterCards(this, 'mod-files-list')"></div>
      <div id="mod-files-list">
        ${modifiedFiles.map(f => renderFileCard(f, modMap[f.path], 'modified')).join('')}
      </div>
    </div>

    <!-- Auditoria Sênior -->
    <div class="section" id="auditoria">
      <h2>🛡️ Quality Gate de Engenharia de Software</h2>
      <div class="quality-gate-item">
        <div class="qg-header"><h4><span class="dot" style="background:var(--indigo)"></span>Princípios SOLID (SRP, OCP, LSP, ISP, DIP)</h4><span class="qg-tag" style="color:var(--indigo)">Arquitetura de Objetos</span></div>
        <p>${escHTML(audit.solid_summary || 'Princípios SOLID avaliados.')}</p>
      </div>
      <div class="quality-gate-item">
        <div class="qg-header"><h4><span class="dot" style="background:var(--blue)"></span>Clean Code & Pythonismo (PEP 8, Type Hints)</h4><span class="qg-tag" style="color:var(--blue)">Legibilidade</span></div>
        <p>${escHTML(audit.clean_code_summary || 'Clean Code avaliado.')}</p>
      </div>
      <div class="quality-gate-item">
        <div class="qg-header"><h4><span class="dot" style="background:var(--emerald)"></span>YAGNI & KISS (Filtro Anti-Overengineering)</h4><span class="qg-tag" style="color:var(--emerald)">Pragmatismo</span></div>
        <p>${escHTML(audit.yagni_summary || 'Pragmático.')}</p>
      </div>
      <div class="quality-gate-item">
        <div class="qg-header"><h4><span class="dot" style="background:var(--amber)"></span>Riscos de Regressão & Quebra de Contratos</h4><span class="qg-tag" style="color:var(--amber)">Resiliência</span></div>
        <p>${escHTML(audit.risks_and_regressions || 'Baixo risco de regressão.')}</p>
      </div>
      <div class="quality-gate-item">
        <div class="qg-header"><h4><span class="dot" style="background:var(--purple)"></span>Estratégia & Qualidade dos Testes</h4><span class="qg-tag" style="color:var(--purple)">Garantia da Qualidade</span></div>
        <p>${escHTML(audit.testing_evaluation || 'Testes avaliados.')}</p>
      </div>
    </div>

    <div class="footer">
      Gerado por Code Review Assist (AI + AST Visual) em ${timestamp} — ${escHTML(repoName)} — ${escHTML(baseBranch)} ← ${escHTML(headBranch)}
    </div>
  </div>

  <script>
    function filterCards(input, containerId) {
      const q = input.value.toLowerCase();
      const container = document.getElementById(containerId);
      const cards = container.querySelectorAll('.file-card');
      cards.forEach(card => {
        const path = card.querySelector('.file-path')?.textContent?.toLowerCase() || '';
        card.style.display = path.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  // Cria o blob e abre em nova aba
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');

  // Também oferece download
  const link = document.createElement('a');
  link.href = url;
  const safeBranch = (headBranch || 'branch').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `walkthrough-${repoName || 'repo'}-${safeBranch}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
