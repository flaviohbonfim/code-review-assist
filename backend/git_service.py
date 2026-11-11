import os
import subprocess
import re
from typing import List, Dict, Any, Optional

WORKING_TREE_REF = "__WORKING_TREE__"

class GitService:
    def __init__(self, repo_path: str):
        self.repo_path = os.path.abspath(os.path.expanduser(repo_path.strip()))
        if not os.path.isdir(self.repo_path):
            raise ValueError(f"O caminho '{repo_path}' não é um diretório válido.")
        if not os.path.isdir(os.path.join(self.repo_path, ".git")):
            raise ValueError(f"O diretório '{repo_path}' não é um repositório Git válido (pasta .git não encontrada).")

    def _run_git(self, args: List[str]) -> str:
        env = os.environ.copy()
        env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:/usr/bin:{env.get('PATH', '')}"
        res = subprocess.run(
            ["git"] + args,
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            env=env,
            encoding="utf-8",
            errors="replace"
        )
        if res.returncode != 0:
            raise RuntimeError(f"Erro no Git ({' '.join(args)}): {res.stderr.strip()}")
        return res.stdout

    def get_branches(self) -> Dict[str, Any]:
        """Retorna branches locais e remotas, além da branch atual e opção de Working Tree."""
        out = self._run_git(["branch", "-a", "--no-color"])
        branches = []
        current = ""
        for line in out.splitlines():
            line_str = line.strip()
            if not line_str or "->" in line_str:
                continue
            is_current = line.startswith("*")
            branch_name = line_str.lstrip("* ").strip()
            if branch_name.startswith("remotes/origin/"):
                branch_name = branch_name.replace("remotes/origin/", "")
            if branch_name not in branches and branch_name != "HEAD" and not branch_name.startswith("(HEAD"):
                branches.append(branch_name)
            if is_current:
                current = branch_name

        # Ordena colocando main/master/develop no topo
        priority = ["main", "master", "develop", "dev", "staging"]
        branches.sort(key=lambda b: (0 if b in priority else 1, priority.index(b) if b in priority else b))

        # Verifica se há alterações não commitadas no working tree
        status_porcelain = self._run_git(["status", "--porcelain"]).strip()
        has_uncommitted = bool(status_porcelain)
        if has_uncommitted or len(branches) <= 1:
            branches.append(WORKING_TREE_REF)

        return {
            "current": current,
            "branches": branches,
            "has_uncommitted": has_uncommitted,
            "repo_name": os.path.basename(self.repo_path),
            "repo_path": self.repo_path
        }

    def get_commit_summary(self, base_branch: str, head_branch: str) -> List[Dict[str, str]]:
        """Lista os commits entre base e head."""
        if head_branch == WORKING_TREE_REF:
            head_ref = "HEAD"
        else:
            head_ref = head_branch

        try:
            range_spec = f"{base_branch}..{head_ref}" if base_branch != head_ref else f"{head_ref}~5..{head_ref}"
            out = self._run_git([
                "log",
                range_spec,
                "--pretty=format:%h|%an|%ar|%s",
                "-n", "50"
            ])
            commits = []
            for line in out.splitlines():
                if not line.strip():
                    continue
                parts = line.split("|", 3)
                if len(parts) == 4:
                    commits.append({
                        "hash": parts[0],
                        "author": parts[1],
                        "time": parts[2],
                        "message": parts[3]
                    })
            return commits
        except Exception:
            return []

    def _build_diff_target_args(self, base_branch: str, head_branch: str) -> List[str]:
        if head_branch == WORKING_TREE_REF:
            return [base_branch]
        if base_branch == head_branch:
            # Se o usuário selecionou a mesma branch, compara com o commit anterior se existir
            return [f"{base_branch}~1", head_branch]
        return [f"{base_branch}...{head_branch}"]

    def get_changed_files(self, base_branch: str, head_branch: str) -> List[Dict[str, Any]]:
        """Lista arquivos alterados com contagem de adições/remoções e status."""
        target_args = self._build_diff_target_args(base_branch, head_branch)
        out = self._run_git(["diff", "--numstat"] + target_args)
        status_out = self._run_git(["diff", "--name-status"] + target_args)
        
        status_map = {}
        for line in status_out.splitlines():
            parts = line.strip().split("\t")
            if len(parts) >= 2:
                status_code = parts[0]
                filename = parts[-1]
                status_map[filename] = status_code

        files = []
        for line in out.splitlines():
            parts = line.strip().split("\t")
            if len(parts) >= 3:
                added_str, deleted_str, filename = parts[0], parts[1], parts[-1]
                added = int(added_str) if added_str.isdigit() else 0
                deleted = int(deleted_str) if deleted_str.isdigit() else 0
                raw_status = status_map.get(filename, "M")
                status = "modified"
                if raw_status.startswith("A"):
                    status = "added"
                elif raw_status.startswith("D"):
                    status = "deleted"
                elif raw_status.startswith("R"):
                    status = "renamed"

                files.append({
                    "path": filename,
                    "filename": os.path.basename(filename),
                    "added": added,
                    "deleted": deleted,
                    "status": status,
                    "extension": os.path.splitext(filename)[1].lower()
                })
        return files

    def get_file_content_at_ref(self, ref: str, file_path: str) -> Optional[str]:
        """Obtém o conteúdo completo do arquivo em uma branch/ref específica ou no Working Tree."""
        if ref == WORKING_TREE_REF:
            full_path = os.path.join(self.repo_path, file_path)
            if os.path.isfile(full_path):
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()
            return None
        try:
            return self._run_git(["show", f"{ref}:{file_path}"])
        except Exception:
            return None

    def get_raw_diff(self, base_branch: str, head_branch: str, file_path: str) -> str:
        """Obtém o diff unificado bruto do arquivo."""
        try:
            target_args = self._build_diff_target_args(base_branch, head_branch)
            return self._run_git(["diff", "-u"] + target_args + ["--", file_path])
        except Exception:
            return ""

    def get_detailed_file_diff(self, base_branch: str, head_branch: str, file_path: str) -> Dict[str, Any]:
        """
        Retorna:
        - base_content: conteúdo completo na branch base
        - head_content: conteúdo completo na branch head
        - line_statuses: mapeamento de cada linha da branch head ('added', 'modified', 'unchanged')
        - removed_blocks_by_line: dicionário {str(head_line_number): [linhas_removidas_antes_desta_linha]}
        """
        actual_base = f"{base_branch}~1" if base_branch == head_branch else base_branch
        base_content = self.get_file_content_at_ref(actual_base, file_path)
        head_content = self.get_file_content_at_ref(head_branch, file_path)

        if head_content is None and base_content is None:
            full_path = os.path.join(self.repo_path, file_path)
            if os.path.isfile(full_path):
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    head_content = f.read()

        raw_diff = self.get_raw_diff(base_branch, head_branch, file_path)

        head_lines = head_content.splitlines() if head_content is not None else []
        line_statuses = ["unchanged"] * len(head_lines)
        modified_lines_indices = set()
        removed_blocks_by_line: Dict[str, List[str]] = {}
        pending_removed: List[str] = []

        hunk_regex = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
        current_head_line = 1
        in_hunk = False

        for diff_line in raw_diff.splitlines():
            m = hunk_regex.match(diff_line)
            if m:
                if pending_removed:
                    anchor = str(min( max(1, current_head_line), max(1, len(head_lines)) ))
                    removed_blocks_by_line.setdefault(anchor, []).extend(pending_removed)
                    pending_removed = []
                in_hunk = True
                current_head_line = int(m.group(3)) # 1-indexed
                continue
            if not in_hunk:
                continue

            if diff_line.startswith("+") and not diff_line.startswith("+++"):
                idx = current_head_line - 1
                if pending_removed:
                    anchor = str(current_head_line)
                    removed_blocks_by_line.setdefault(anchor, []).extend(pending_removed)
                    pending_removed = []
                    if 0 <= idx < len(line_statuses):
                        modified_lines_indices.add(idx)
                if 0 <= idx < len(line_statuses):
                    line_statuses[idx] = "added"
                current_head_line += 1
            elif diff_line.startswith("-") and not diff_line.startswith("---"):
                pending_removed.append(diff_line[1:])
                idx = current_head_line - 1
                if 0 <= idx < len(line_statuses):
                    modified_lines_indices.add(idx)
            elif diff_line.startswith(" "):
                if pending_removed:
                    anchor = str(current_head_line)
                    removed_blocks_by_line.setdefault(anchor, []).extend(pending_removed)
                    pending_removed = []
                current_head_line += 1

        if pending_removed and head_lines:
            anchor = str(min(max(1, current_head_line), len(head_lines)))
            removed_blocks_by_line.setdefault(anchor, []).extend(pending_removed)

        for idx in modified_lines_indices:
            if 0 <= idx < len(line_statuses) and line_statuses[idx] == "added":
                line_statuses[idx] = "modified"

        total_added = line_statuses.count("added")
        total_modified = line_statuses.count("modified")

        return {
            "file_path": file_path,
            "base_content": base_content,
            "head_content": head_content,
            "total_lines": len(head_lines),
            "line_statuses": line_statuses,
            "removed_blocks_by_line": removed_blocks_by_line,
            "added_count": total_added,
            "modified_count": total_modified,
            "raw_diff": raw_diff
        }
