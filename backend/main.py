import os
import subprocess
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from git_service import GitService
from ast_service import ASTService
from categorizer import Categorizer
from ai_service import AIService

app = FastAPI(title="Code Review Assist API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Modelos Pydantic -----------------

class RepoPathRequest(BaseModel):
    repo_path: str

class CompareRequest(BaseModel):
    repo_path: str
    base_branch: str
    head_branch: str

class FileDiffRequest(BaseModel):
    repo_path: str
    base_branch: str
    head_branch: str
    file_path: str

class AIReviewRequest(BaseModel):
    code: str
    lens: str # "solid", "clean_code", "docstrings", "bugs_security", "static_analysis"
    file_path: str = ""
    provider: str = "claude" # "claude" ou "gemini"
    api_key: Optional[str] = None

class GenerateClaudePromptRequest(BaseModel):
    repo_name: str
    base_branch: str
    head_branch: str
    review_notes: List[Dict[str, Any]]

# ----------------- Rotas da API -----------------

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Code Review Assist"}

@app.post("/api/repo/select-folder")
def select_folder_via_finder():
    """Abre a janela nativa do Finder do macOS para o usuário escolher o diretório do repositório."""
    try:
        script = 'POSIX path of (choose folder with prompt "Selecione a pasta do repositório Git:")'
        res = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=120
        )
        if res.returncode != 0:
            return {"cancelled": True, "path": None}

        selected_path = res.stdout.strip()
        if selected_path.endswith("/"):
            selected_path = selected_path[:-1]

        git = GitService(selected_path)
        branches_data = git.get_branches()
        return {
            "cancelled": False,
            "path": selected_path,
            **branches_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/repo/branches")
def list_branches(req: RepoPathRequest):
    try:
        git = GitService(req.repo_path)
        return git.get_branches()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/repo/compare")
def compare_branches(req: CompareRequest):
    try:
        git = GitService(req.repo_path)
        commits = git.get_commit_summary(req.base_branch, req.head_branch)
        raw_files = git.get_changed_files(req.base_branch, req.head_branch)
        grouped = Categorizer.group_and_summarize(raw_files)

        # Monta grafo de dependências real entre os arquivos Python alterados via AST
        graph_nodes = []
        graph_edges = []
        module_to_path: Dict[str, str] = {}

        for f in raw_files:
            p = f["path"]
            cat = Categorizer.categorize_file(f)
            graph_nodes.append({
                "id": p,
                "label": f["filename"],
                "layer": cat["layer"],
                "status": f["status"],
                "added": f["added"],
                "deleted": f["deleted"]
            })
            if p.endswith(".py"):
                stem = os.path.splitext(os.path.basename(p))[0]
                module_to_path[stem] = p
                dotted = os.path.splitext(p)[0].replace("/", ".")
                module_to_path[dotted] = p

        # Extrai imports dos arquivos Python (limitado aos primeiros 60 para manter performance em PRs gigantes)
        py_files = [f for f in raw_files if f["path"].endswith(".py") and f["status"] != "deleted"][:60]
        seen_edges = set()
        for f in py_files:
            content = git.get_file_content_at_ref(req.head_branch, f["path"])
            if not content:
                continue
            dep_info = ASTService.extract_dependencies(f["path"], content)
            for imp in dep_info.get("imports", []):
                parts = imp.split(".")
                for candidate in [imp, parts[0], parts[-1]]:
                    target_path = module_to_path.get(candidate)
                    if target_path and target_path != f["path"]:
                        edge_key = (f["path"], target_path)
                        if edge_key not in seen_edges:
                            seen_edges.add(edge_key)
                            graph_edges.append({
                                "from": f["path"],
                                "to": target_path,
                                "from_label": os.path.basename(f["path"]),
                                "to_label": os.path.basename(target_path),
                                "import_name": imp
                            })

        return {
            "repo_name": os.path.basename(git.repo_path),
            "base_branch": req.base_branch,
            "head_branch": req.head_branch,
            "commits": commits,
            "summary": grouped,
            "graph": {
                "nodes": graph_nodes,
                "edges": graph_edges
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/repo/file-diff")
def get_file_diff(req: FileDiffRequest):
    try:
        git = GitService(req.repo_path)
        diff_data = git.get_detailed_file_diff(req.base_branch, req.head_branch, req.file_path)

        # Se for Python, analisa com AST para identificar escopos e blocos que podem ser colapsados (unchanged)
        foldable_ranges = []
        scopes = []
        if req.file_path.endswith(".py") and diff_data["head_content"]:
            scopes = ASTService.parse_python_scopes(diff_data["head_content"])
            foldable_ranges = ASTService.calculate_foldable_ranges(scopes, diff_data["line_statuses"])

        return {
            **diff_data,
            "scopes": scopes,
            "foldable_ranges": foldable_ranges
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ai/review")
async def review_code(req: AIReviewRequest):
    try:
        if req.lens == "static_analysis":
            return AIService.run_static_analysis(req.code)

        if req.provider == "claude":
            return await AIService.review_with_claude_cli(req.code, req.lens, req.file_path)
        elif req.provider == "gemini":
            return await AIService.review_with_gemini(req.code, req.lens, req.file_path, req.api_key)
        else:
            raise HTTPException(status_code=400, detail=f"Provedor '{req.provider}' desconhecido. Use 'claude' ou 'gemini'.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/generate-claude-prompt")
def generate_claude_prompt(req: GenerateClaudePromptRequest):
    prompt = AIService.generate_claude_prompt(
        req.repo_name,
        req.base_branch,
        req.head_branch,
        req.review_notes
    )
    return {"prompt": prompt}

# Se existir a pasta build/dist do frontend, serve diretamente
dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
