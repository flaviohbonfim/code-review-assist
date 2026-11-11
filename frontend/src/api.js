const API_BASE =
  typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '3000')
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : '/api';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function selectFolderViaFinder() {
  const res = await fetch(`${API_BASE}/repo/select-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao abrir o Finder' }));
    throw new Error(err.detail || 'Falha ao abrir o Finder');
  }
  return res.json();
}

export async function listBranches(repoPath) {
  const res = await fetch(`${API_BASE}/repo/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao listar branches' }));
    throw new Error(err.detail || 'Falha ao listar branches');
  }
  return res.json();
}

export async function compareBranches(repoPath, baseBranch, headBranch) {
  const res = await fetch(`${API_BASE}/repo/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      base_branch: baseBranch,
      head_branch: headBranch
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao comparar branches' }));
    throw new Error(err.detail || 'Falha ao comparar branches');
  }
  return res.json();
}

export async function getFileDiff(repoPath, baseBranch, headBranch, filePath) {
  const res = await fetch(`${API_BASE}/repo/file-diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      base_branch: baseBranch,
      head_branch: headBranch,
      file_path: filePath
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao obter diff do arquivo' }));
    throw new Error(err.detail || 'Falha ao obter diff do arquivo');
  }
  return res.json();
}

export async function runAIReview(code, lens, filePath = '', provider = 'claude', apiKey = null) {
  const res = await fetch(`${API_BASE}/ai/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      lens,
      file_path: filePath,
      provider,
      api_key: apiKey
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha na avaliação da IA' }));
    throw new Error(err.detail || 'Falha na avaliação da IA');
  }
  return res.json();
}

export async function explainPR(repoPath, baseBranch, headBranch, provider = 'claude', apiKey = null) {
  const res = await fetch(`${API_BASE}/ai/explain-pr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      base_branch: baseBranch,
      head_branch: headBranch,
      provider,
      api_key: apiKey
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao gerar explicação do PR' }));
    throw new Error(err.detail || 'Falha ao gerar explicação do PR');
  }
  return res.json();
}

export async function generateClaudePrompt(repoName, baseBranch, headBranch, reviewNotes) {
  const res = await fetch(`${API_BASE}/ai/generate-claude-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_name: repoName,
      base_branch: baseBranch,
      head_branch: headBranch,
      review_notes: reviewNotes
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Falha ao gerar prompt para o Claude' }));
    throw new Error(err.detail || 'Falha ao gerar prompt para o Claude');
  }
  return res.json();
}
