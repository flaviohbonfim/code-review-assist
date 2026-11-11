import os
import subprocess
import json
import re
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

LENS_PROMPTS = {
    "solid": """Você é um especialista em arquitetura de software e princípios SOLID.
Analise o código Python fornecido (especialmente as partes alteradas) sob as 5 lentes:
1. Single Responsibility (SRP): classes ou funções com muitas responsabilidades ou propósitos misturados?
2. Open/Closed (OCP): o código é extensível sem modificar classes base?
3. Liskov Substitution (LSP): subtipos quebram expectativas de tipos base?
4. Interface Segregation (ISP): interfaces ou abstrações gordas demais?
5. Dependency Inversion (DIP): alto acoplamento com classes concretas em vez de injeção de dependência?

Retorne sua resposta estritamente em formato JSON válido contendo uma lista de ocorrências:
{
  "issues": [
    {
      "line": 42,
      "severity": "warning",
      "lens": "solid",
      "principle": "SRP",
      "title": "Violação de Responsabilidade Única",
      "description": "Explicação concisa do problema.",
      "suggested_fix": "Sugestão de refatoração ou código corrigido"
    }
  ],
  "summary": "Resumo geral da conformidade SOLID em 1-2 frases."
}
""",

    "clean_code": """Você é um especialista em Clean Code e Python idiomático (PEP 8, Zen of Python).
Avalie o código Python fornecido focando em:
1. Clareza e expressividade de nomes de variáveis, métodos e classes.
2. Complexidade ciclomática e aninhamento excessivo (preferir Early Return / Guard Clauses).
3. Uso correto e completo de Type Annotations (type hints).
4. Funções longas que deveriam ser divididas.
5. Padrões anti-pythonic.

Retorne sua resposta estritamente em formato JSON válido:
{
  "issues": [
    {
      "line": 15,
      "severity": "suggestion",
      "lens": "clean_code",
      "title": "Aninhamento profundo evitável",
      "description": "Pode usar early return no início da função para reduzir a indentação.",
      "suggested_fix": "if not user:\\n    return None"
    }
  ],
  "summary": "Resumo geral da legibilidade e Clean Code em 1-2 frases."
}
""",

    "docstrings": """Você é um auditor sênior de documentação técnica focado em códigos gerados ou editados por IA (como Claude).
Problema comum de IA: ela altera o código mas mantém docstrings antigas, inventa parâmetros inexistentes ou cria comentários óbvios que só poluem o código.

Analise estritamente:
1. Veracidade de Docstrings: cada docstring reflete exatamente o comportamento atual, tipos de argumentos e retorno da função? Há parâmetros que não existem mais ou faltam documentar?
2. Filtro Anti-Ruído de Comentários: aponte comentários redundantes ou óbvios (ex.: `# incrementa i`, `# cria o cliente`) que devem ser removidos para manter o código limpo.
3. Se a docstring explica o *porquê* ou a regra de negócio quando relevante, em vez de só repetir o nome da função.

Retorne sua resposta estritamente em formato JSON válido:
{
  "issues": [
    {
      "line": 28,
      "severity": "warning",
      "lens": "docstrings",
      "title": "Docstring desatualizada ou incorreta",
      "description": "A docstring lista o parâmetro 'tenant_id' que foi removido da assinatura na nova versão.",
      "suggested_fix": "Remover :param tenant_id: e atualizar tipos de retorno."
    }
  ],
  "summary": "Resumo da aderência das docstrings e comentários em 1-2 frases."
}
""",

    "bugs_security": """Você é um engenheiro sênior de segurança e confiabilidade de software em Python.
Analise o código procurando:
1. Bugs comuns: argumentos padrão mutáveis (ex.: `def f(items=[])`), referências a variáveis não inicializadas, NoneType dereferencing.
2. Tratamento perigoso de exceções: blocos `except Exception: pass` silenciosos ou genéricos demais.
3. Segurança: vulnerabilidades como injeção SQL, formatação insegura de strings para comandos, vazamento de credenciais.
4. Performance: problemas de N+1 queries em ORMs, loops ineficientes, vazamento de conexões/arquivos abertos.

Retorne sua resposta estritamente em formato JSON válido:
{
  "issues": [
    {
      "line": 64,
      "severity": "error",
      "lens": "bugs_security",
      "title": "Argumento padrão mutável perigoso",
      "description": "Utilizar [] como default compartilha a mesma lista entre chamadas.",
      "suggested_fix": "def my_func(items: Optional[List] = None):\\n    items = items or []"
    }
  ],
  "summary": "Resumo dos riscos e segurança em 1-2 frases."
}
"""
}

class AIService:
    @staticmethod
    def _clean_json_response(raw_text: str) -> Dict[str, Any]:
        """Extrai bloco JSON limpo de respostas com Markdown ou texto extra."""
        text = raw_text.strip()
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            text = m.group(1).strip()
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                text = text[start:end+1]

        try:
            return json.loads(text)
        except Exception:
            return {
                "issues": [],
                "summary": raw_text[:300] if raw_text else "Nenhuma observação encontrada.",
                "raw": raw_text
            }

    @classmethod
    async def review_with_claude_cli(cls, code: str, lens: str, file_path: str = "") -> Dict[str, Any]:
        """Executa a revisão via Claude CLI local (claude -p '...')."""
        prompt_instruction = LENS_PROMPTS.get(lens, LENS_PROMPTS["clean_code"])
        full_prompt = (
            f"{prompt_instruction}\n\n"
            f"Arquivo: {file_path}\n"
            f"Código para análise:\n```python\n{code}\n```\n\n"
            f"Responda APENAS com o JSON solicitado."
        )

        claude_bin = "/opt/homebrew/bin/claude"
        if not os.path.exists(claude_bin):
            claude_bin = "claude"

        env = os.environ.copy()
        env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:/usr/bin:{env.get('PATH', '')}"

        try:
            process = subprocess.run(
                [claude_bin, "-p", full_prompt],
                capture_output=True,
                text=True,
                env=env,
                timeout=90,
                encoding="utf-8",
                errors="replace"
            )
            if process.returncode != 0:
                return {
                    "error": f"Erro ao executar Claude CLI: {process.stderr.strip() or process.stdout.strip()}",
                    "issues": [],
                    "summary": "Falha na chamada do Claude CLI."
                }
            return cls._clean_json_response(process.stdout)
        except subprocess.TimeoutExpired:
            return {"error": "Timeout ao executar Claude CLI (mais de 90s).", "issues": [], "summary": "Timeout"}
        except Exception as e:
            return {"error": f"Exceção ao chamar Claude CLI: {str(e)}", "issues": [], "summary": "Erro de execução"}

    @classmethod
    async def review_with_gemini(cls, code: str, lens: str, file_path: str = "", api_key: Optional[str] = None) -> Dict[str, Any]:
        """Executa a revisão via Gemini API."""
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            return {
                "error": "Chave da API do Gemini não configurada (defina GEMINI_API_KEY ou informe nas configurações).",
                "issues": [],
                "summary": "Chave Gemini ausente."
            }

        prompt_instruction = LENS_PROMPTS.get(lens, LENS_PROMPTS["clean_code"])
        prompt = (
            f"{prompt_instruction}\n\n"
            f"Arquivo: {file_path}\n"
            f"Código:\n```python\n{code}\n```\n\n"
            f"Retorne APENAS o JSON especificado sem rodeios."
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw_body = resp.read().decode("utf-8", errors="replace")
                data = json.loads(raw_body)
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return cls._clean_json_response(text)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            return {
                "error": f"Erro na API Gemini ({e.code}): {err_body}",
                "issues": [],
                "summary": "Erro na API Gemini."
            }
        except Exception as e:
            return {
                "error": f"Falha de conexão com Gemini: {str(e)}",
                "issues": [],
                "summary": "Falha de rede ao conectar no Gemini."
            }

    @classmethod
    def run_static_analysis(cls, code: str) -> Dict[str, Any]:
        """Análise estática instantânea baseada em AST para apontar falhas comuns sem gastar tokens."""
        import ast
        issues = []
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return {
                "issues": [{
                    "line": e.lineno or 1,
                    "severity": "error",
                    "lens": "static_analysis",
                    "title": "Erro de Sintaxe Python",
                    "description": str(e.msg),
                    "suggested_fix": "Corrigir a sintaxe antes de revisar."
                }],
                "summary": f"Erro de sintaxe encontrado na linha {e.lineno}."
            }

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for default in node.args.defaults + node.args.kw_defaults:
                    if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                        issues.append({
                            "line": default.lineno,
                            "severity": "error",
                            "lens": "static_analysis",
                            "title": "Argumento padrão mutável (Mutable Default Arg)",
                            "description": f"A função '{node.name}' usa valor mutável padrão. Isso gera compartilhamento de estado entre chamadas.",
                            "suggested_fix": "Substituir por None como padrão e inicializar dentro do corpo da função."
                        })

                docstring = ast.get_docstring(node)
                end_lineno = getattr(node, "end_lineno", node.lineno)
                if not docstring and (end_lineno - node.lineno > 10):
                    issues.append({
                        "line": node.lineno,
                        "severity": "suggestion",
                        "lens": "static_analysis",
                        "title": "Função extensa sem Docstring",
                        "description": f"A função '{node.name}' tem {end_lineno - node.lineno} linhas e nenhuma docstring explicativa.",
                        "suggested_fix": f"Adicionar docstring detalhando o propósito e comportamento de '{node.name}'."
                    })

            elif isinstance(node, ast.ExceptHandler):
                if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    issues.append({
                        "line": node.lineno,
                        "severity": "warning",
                        "lens": "static_analysis",
                        "title": "Exceção silenciada (except ... pass)",
                        "description": "Capturar erro e ignorar com pass pode mascarar bugs críticos em tempo de execução.",
                        "suggested_fix": "Adicionar log estruturado ou tratar o erro específico."
                    })

        return {
            "issues": issues,
            "summary": f"Análise estática concluída: {len(issues)} pontos identificados."
        }

    @staticmethod
    def generate_claude_prompt(
        repo_name: str,
        base_branch: str,
        head_branch: str,
        review_notes: List[Dict[str, Any]]
    ) -> str:
        """Gera um prompt estruturado para o Claude Code corrigir tudo de uma só vez."""
        if not review_notes:
            return (
                "Nenhuma observação ou pendência foi marcada nesta revisão. "
                "O código está aprovado para merge!"
            )

        prompt_lines = [
            f"# Solicitação de Correções de Code Review ({repo_name})",
            f"**Branches:** `{base_branch}` -> `{head_branch}`",
            "",
            "Durante a revisão de código da task, foram identificados pontos que precisam de correção antes do merge.",
            "Por favor, aplique as refatorações e correções detalhadas abaixo em cada arquivo correspondente.",
            "",
            "---",
            ""
        ]

        by_file: Dict[str, List[Dict[str, Any]]] = {}
        for note in review_notes:
            f = note.get("file_path", "Arquivo Geral")
            if f not in by_file:
                by_file[f] = []
            by_file[f].append(note)

        for file_path, items in by_file.items():
            prompt_lines.append(f"### Arquivo: `{file_path}`")
            prompt_lines.append("")
            for idx, item in enumerate(items, 1):
                line = item.get("line")
                line_str = f"Linha {line}" if line else "Geral no arquivo"
                title = item.get("title", "Ajuste necessário")
                desc = item.get("description", "")
                fix = item.get("suggested_fix", "")
                severity = item.get("severity", "warning").upper()

                prompt_lines.append(f"{idx}. **[{severity}] {title}** ({line_str})")
                if desc:
                    prompt_lines.append(f"   - **Problema:** {desc}")
                if fix:
                    prompt_lines.append(f"   - **Como corrigir / Sugestão:** {fix}")
            prompt_lines.append("")

        prompt_lines.extend([
            "---",
            "### Instruções para a IA:",
            "1. Edite os arquivos indicados respeitando a arquitetura existente.",
            "2. Mantenha os type hints rigorosos e atualize as docstrings conforme a nova lógica.",
            "3. Execute os testes unitários afetados após as alterações para garantir que nada foi quebrado.",
            "4. Forneça um resumo objetivo de cada alteração realizada."
        ])

        return "\n".join(prompt_lines)

    @classmethod
    async def explain_pr(
        cls,
        repo_name: str,
        base_branch: str,
        head_branch: str,
        commits: List[Dict[str, str]],
        files_summary: List[Dict[str, Any]],
        provider: str = "claude",
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera uma explicação técnica narrativa e detalhada do PR (Walkthrough contando via código):
        o que foi adicionado, o que faz cada arquivo novo e como os arquivos existentes foram alterados.
        """
        prompt = f"""Você é um Engenheiro de Software Principal realizando o walkthrough técnico completo de um Pull Request ({repo_name}).
Sua missão é explicar para outros desenvolvedores exatamente o que foi feito na aplicação, contando a história através do código alterado e novo.

INFORMAÇÕES DA TASK:
- Repositório: {repo_name}
- Branches: {base_branch} -> {head_branch}
- Commits na task: {json.dumps(commits, ensure_ascii=False)}

ARQUIVOS DE LÓGICA E MODIFICAÇÕES DE CÓDIGO:
{json.dumps(files_summary, ensure_ascii=False, indent=2)}

Sua resposta DEVE ser estritamente em formato JSON válido contendo:
{{
  "executive_summary": "Resumo claro e direto em 2-3 frases do que este PR implementa e qual capacidade de negócio a aplicação ganhou.",
  "new_capabilities": [
    "Capacidade 1 que o sistema agora possui",
    "Capacidade 2..."
  ],
  "architectural_story": "Narrativa técnica explicando como o fluxo de execução funciona entre os arquivos (ex: A rota X recebe a requisição, chama o novo serviço Y, que processa a regra Z e persiste no Model W).",
  "files_explained": [
    {{
      "path": "caminho/do/arquivo.py",
      "filename": "arquivo.py",
      "status": "added",
      "badge_label": "Novo Arquivo",
      "purpose": "O que este arquivo faz e qual sua responsabilidade no sistema.",
      "code_changes": "O que especificamente foi adicionado ou modificado via código (cite nomes reais de classes, métodos, decorators, parâmetros e regras novas). Exemplo: 'Adicionou o método process_payment que valida o saldo e despacha evento para a fila.'",
      "impact": "Como esta alteração impacta o restante do app."
    }}
  ]
}}

IMPORTANTE: Seja específico e focado em código real, sem inventar arquivos que não estão na lista.
"""
        if provider == "claude":
            claude_bin = "/opt/homebrew/bin/claude"
            if not os.path.exists(claude_bin):
                claude_bin = "claude"
            env = os.environ.copy()
            env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:/usr/bin:{env.get('PATH', '')}"
            try:
                process = subprocess.run(
                    [claude_bin, "-p", prompt],
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=120,
                    encoding="utf-8",
                    errors="replace"
                )
                if process.returncode != 0:
                    return {
                        "error": f"Erro no Claude CLI: {process.stderr.strip() or process.stdout.strip()}",
                        "executive_summary": "Falha na geração do walkthrough via Claude CLI.",
                        "files_explained": []
                    }
                return cls._clean_json_response(process.stdout)
            except Exception as e:
                return {
                    "error": f"Erro ao chamar Claude CLI: {str(e)}",
                    "executive_summary": "Erro na execução do Claude CLI.",
                    "files_explained": []
                }
        elif provider == "gemini":
            key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            if not key:
                return {
                    "error": "Chave da API do Gemini não configurada.",
                    "executive_summary": "Chave Gemini ausente.",
                    "files_explained": []
                }
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
            }
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=90) as resp:
                    raw_body = resp.read().decode("utf-8", errors="replace")
                    data = json.loads(raw_body)
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return cls._clean_json_response(text)
            except Exception as e:
                return {
                    "error": f"Erro na API Gemini: {str(e)}",
                    "executive_summary": "Erro de conexão com o Gemini.",
                    "files_explained": []
                }
        else:
            return {"error": f"Provedor {provider} desconhecido.", "files_explained": []}
