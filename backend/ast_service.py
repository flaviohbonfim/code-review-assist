import ast
from typing import List, Dict, Any, Optional, Set

class ASTService:
    @staticmethod
    def parse_python_scopes(code: str) -> List[Dict[str, Any]]:
        """
        Extrai classes, métodos e funções do código com suas linhas de início e fim,
        docstrings e assinaturas.
        """
        if not code:
            return []
        try:
            tree = ast.parse(code)
        except Exception:
            return []

        scopes = []

        class ScopeVisitor(ast.NodeVisitor):
            def __init__(self):
                self.current_class = None

            def visit_ClassDef(self, node: ast.ClassDef):
                docstring = ast.get_docstring(node) or ""
                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line)
                
                scopes.append({
                    "type": "class",
                    "name": node.name,
                    "parent_class": None,
                    "start_line": start_line,
                    "end_line": end_line,
                    "docstring": docstring,
                    "params": [b.id for b in node.bases if isinstance(b, ast.Name)]
                })

                prev_class = self.current_class
                self.current_class = node.name
                self.generic_visit(node)
                self.current_class = prev_class

            def visit_FunctionDef(self, node: ast.FunctionDef):
                self._handle_func(node, is_async=False)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                self._handle_func(node, is_async=True)

            def _handle_func(self, node, is_async: bool):
                docstring = ast.get_docstring(node) or ""
                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line)
                args = [a.arg for a in node.args.args]
                
                # Tipo de retorno anotado se houver
                returns = ""
                if node.returns:
                    try:
                        returns = ast.unparse(node.returns)
                    except Exception:
                        returns = ""

                scopes.append({
                    "type": "method" if self.current_class else "function",
                    "name": node.name,
                    "parent_class": self.current_class,
                    "is_async": is_async,
                    "start_line": start_line,
                    "end_line": end_line,
                    "docstring": docstring,
                    "params": args,
                    "returns": returns
                })
                self.generic_visit(node)

        visitor = ScopeVisitor()
        visitor.visit(tree)
        # Ordena por linha de início
        scopes.sort(key=lambda s: s["start_line"])
        return scopes

    @staticmethod
    def calculate_foldable_ranges(scopes: List[Dict[str, Any]], line_statuses: List[str]) -> List[Dict[str, Any]]:
        """
        Determina quais funções ou classes NÃO sofreram nenhuma alteração (0 linhas added ou modified).
        Esses blocos são marcados como 'can_collapse' = True por padrão para despoluir a visualização.
        """
        foldable = []
        for scope in scopes:
            s_line = scope["start_line"]
            e_line = scope["end_line"]

            # Linhas 1-indexed -> índices 0-indexed
            touched = False
            for line_idx in range(s_line - 1, min(e_line, len(line_statuses))):
                if line_statuses[line_idx] in ("added", "modified"):
                    touched = True
                    break

            foldable.append({
                "type": scope["type"],
                "name": scope["name"],
                "parent_class": scope["parent_class"],
                "start_line": s_line,
                "end_line": e_line,
                "has_changes": touched,
                # Pode colapsar se não foi tocado e tem pelo menos 4 linhas
                "can_collapse": (not touched) and (e_line - s_line >= 3),
                "docstring": scope["docstring"],
                "params": scope["params"],
                "returns": scope.get("returns", "")
            })
        return foldable

    @staticmethod
    def extract_dependencies(file_path: str, code: str) -> Dict[str, Any]:
        """
        Extrai imports locais e referências para construir o Grafo de Dependências/Fluxo do PR.
        """
        if not code or not file_path.endswith(".py"):
            return {"file": file_path, "imports": []}

        try:
            tree = ast.parse(code)
        except Exception:
            return {"file": file_path, "imports": []}

        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    imports.append(f"{module}.{alias.name}" if module else alias.name)

        return {
            "file": file_path,
            "imports": list(set(imports))
        }
