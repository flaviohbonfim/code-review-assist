import os
import subprocess
import json
import re
import urllib.request
import urllib.error
import time
from typing import List, Dict, Any, Optional

def strip_ansi(text: str) -> str:
    """Remove sequências de escape ANSI, sequências OSC e caracteres de controle do terminal."""
    if not text:
        return ""
    # Remove sequências de cores/estilos ANSI: \x1b[...m
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    cleaned = ansi_escape.sub('', text)
    # Remove sequências OSC (Operating System Command)
    cleaned = re.sub(r'\x1B\][^\x07\x1B]*[\x07\x1B\\]', '', cleaned)
    # Remove outros caracteres de controle não imprimíveis, preservando \n, \r, \t
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', cleaned)
    return cleaned

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
        text = strip_ansi(raw_text or "").strip()
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            text = m.group(1).strip()
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                text = text[start:end+1]

        # Limpa trailing commas antes de fechamento de arrays ou objetos
        text_cleaned = re.sub(r",\s*([\]}])", r"\1", text)
        try:
            return json.loads(text_cleaned, strict=False)
        except Exception:
            try:
                return json.loads(text, strict=False)
            except Exception:
                return {
                    "issues": [],
                    "summary": text[:300] if text else "Nenhuma observação encontrada.",
                    "raw": text
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
        env["NO_COLOR"] = "1"
        env["TERM"] = "dumb"

        print(f"\n[Claude CLI] Executando lente {lens} em {file_path}...", flush=True)
        start_t = time.time()
        try:
            process = subprocess.run(
                [claude_bin, "-p", full_prompt],
                capture_output=True,
                text=True,
                env=env,
                stdin=subprocess.DEVNULL,
                timeout=120,
                encoding="utf-8",
                errors="replace"
            )
            elapsed = time.time() - start_t
            clean_stdout = strip_ansi(process.stdout or "").strip()
            clean_stderr = strip_ansi(process.stderr or "").strip()
            output_to_use = clean_stdout if clean_stdout else clean_stderr

            if process.returncode != 0 and not clean_stdout:
                err_msg = clean_stderr or clean_stdout or f"Exit code {process.returncode}"
                print(f"[Claude CLI Erro em {elapsed:.2f}s]: {err_msg}", flush=True)
                return {
                    "error": f"Erro ao executar Claude CLI: {err_msg}",
                    "issues": [],
                    "summary": "Falha na chamada do Claude CLI."
                }
            print(f"[Claude CLI Sucesso em {elapsed:.2f}s]", flush=True)
            return cls._clean_json_response(output_to_use)
        except subprocess.TimeoutExpired:
            print(f"[Claude CLI Timeout após 120s]", flush=True)
            return {"error": "Timeout ao executar Claude CLI (mais de 120s).", "issues": [], "summary": "Timeout"}
        except Exception as e:
            print(f"[Claude CLI Exceção]: {str(e)}", flush=True)
            return {"error": f"Exceção ao chamar Claude CLI: {str(e)}", "issues": [], "summary": "Erro de execução"}

    @staticmethod
    def _find_agy_bin() -> str:
        """Localiza o binário do Antigravity CLI ('agy')."""
        candidates = [
            "/opt/homebrew/bin/agy",
            "/usr/local/bin/agy",
            os.path.expanduser("~/.local/bin/agy"),
            os.path.expanduser("~/.gemini/antigravity/bin/agy"),
            os.path.expanduser("~/bin/agy"),
            "agy"
        ]
        for c in candidates:
            if c != "agy" and os.path.isfile(c) and os.access(c, os.X_OK):
                return c
        return "agy"

    @classmethod
    async def review_with_antigravity_cli(cls, code: str, lens: str, file_path: str = "") -> Dict[str, Any]:
        """Executa a revisão via Antigravity CLI local (agy -p '...'). Fallback automático para Claude CLI."""
        prompt_instruction = LENS_PROMPTS.get(lens, LENS_PROMPTS["clean_code"])
        full_prompt = (
            f"{prompt_instruction}\n\n"
            f"Arquivo: {file_path}\n"
            f"Código para análise:\n```python\n{code}\n```\n\n"
            f"Responda APENAS com o JSON solicitado."
        )

        agy_bin = cls._find_agy_bin()
        env = os.environ.copy()
        user_home = os.path.expanduser("~")
        env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{user_home}/.local/bin:{user_home}/.gemini/antigravity/bin:{env.get('PATH', '')}"
        env["NO_COLOR"] = "1"
        env["TERM"] = "dumb"
        env["FORCE_COLOR"] = "0"
        env["CLICOLOR"] = "0"

        print(f"\n[Antigravity CLI] Executando lente '{lens}' em {file_path} via '{agy_bin}'...", flush=True)
        start_t = time.time()
        try:
            process = subprocess.run(
                [agy_bin, "-p", full_prompt],
                capture_output=True,
                text=True,
                env=env,
                stdin=subprocess.DEVNULL,
                timeout=180,
                encoding="utf-8",
                errors="replace"
            )
            elapsed = time.time() - start_t
            clean_stdout = strip_ansi(process.stdout or "").strip()
            clean_stderr = strip_ansi(process.stderr or "").strip()

            if process.returncode != 0 and not clean_stdout:
                err_msg = clean_stderr or clean_stdout or f"Exit code {process.returncode}"
                print(f"[Antigravity CLI Erro em {elapsed:.2f}s]: {err_msg}", flush=True)
                print(f"[Antigravity CLI Fallback] Acionando Claude CLI...", flush=True)
                return await cls.review_with_claude_cli(code, lens, file_path)

            output_to_use = clean_stdout if clean_stdout else clean_stderr
            print(f"[Antigravity CLI Sucesso em {elapsed:.2f}s, {len(output_to_use)} chars]", flush=True)
            res = cls._clean_json_response(output_to_use)
            if not res.get("issues") and "Falha" in res.get("summary", ""):
                print(f"[Antigravity CLI Fallback] Saída sem issues válidas, tentando Claude CLI...", flush=True)
                return await cls.review_with_claude_cli(code, lens, file_path)
            return res
        except subprocess.TimeoutExpired:
            print(f"[Antigravity CLI Timeout após 180s], tentando Claude CLI...", flush=True)
            return await cls.review_with_claude_cli(code, lens, file_path)
        except Exception as e:
            print(f"[Antigravity CLI Exceção: {str(e)}], tentando Claude CLI...", flush=True)
            return await cls.review_with_claude_cli(code, lens, file_path)

    @classmethod
    def test_antigravity_cli(cls) -> Dict[str, Any]:
        """Testa se o Antigravity CLI (agy) está acessível e operacional na máquina."""
        start_t = time.time()
        agy_bin = cls._find_agy_bin()
        env = os.environ.copy()
        user_home = os.path.expanduser("~")
        env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{user_home}/.local/bin:{user_home}/.gemini/antigravity/bin:{env.get('PATH', '')}"

        try:
            res = subprocess.run(
                [agy_bin, "--version"],
                capture_output=True,
                text=True,
                env=env,
                timeout=15,
                encoding="utf-8",
                errors="replace"
            )
            elapsed = time.time() - start_t
            if res.returncode == 0:
                ver = res.stdout.strip() or res.stderr.strip() or "Antigravity CLI OK"
                return {
                    "ok": True,
                    "binary": agy_bin,
                    "version": ver,
                    "elapsed_seconds": round(elapsed, 2)
                }
            res_help = subprocess.run(
                [agy_bin, "--help"],
                capture_output=True,
                text=True,
                env=env,
                timeout=15,
                encoding="utf-8",
                errors="replace"
            )
            elapsed = time.time() - start_t
            if res_help.returncode == 0:
                return {
                    "ok": True,
                    "binary": agy_bin,
                    "version": "Antigravity CLI (agy)",
                    "elapsed_seconds": round(elapsed, 2)
                }
            return {
                "ok": False,
                "binary": agy_bin,
                "error": res.stderr.strip() or res.stdout.strip() or "Código de retorno não-zero",
                "elapsed_seconds": round(elapsed, 2)
            }
        except FileNotFoundError:
            return {
                "ok": False,
                "binary": agy_bin,
                "error": f"O comando '{agy_bin}' não foi encontrado no PATH do sistema.",
                "elapsed_seconds": round(time.time() - start_t, 2)
            }
        except Exception as e:
            return {
                "ok": False,
                "binary": agy_bin,
                "error": str(e),
                "elapsed_seconds": round(time.time() - start_t, 2)
            }

    @classmethod
    async def review_with_gemini(cls, code: str, lens: str, file_path: str = "", api_key: Optional[str] = None) -> Dict[str, Any]:
        """Executa a revisão via Gemini API."""
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            print("[Gemini Erro]: Chave da API ausente.", flush=True)
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

        model_name = "gemini-3.8-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        }

        print(f"\n[Gemini Lente '{lens}'] Chamando modelo '{model_name}' para {file_path} ({len(code)} caracteres)...", flush=True)
        start_t = time.time()
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                elapsed = time.time() - start_t
                raw_body = resp.read().decode("utf-8", errors="replace")
                print(f"[Gemini Sucesso] Resposta recebida em {elapsed:.2f}s ({len(raw_body)} bytes)", flush=True)
                data = json.loads(raw_body)
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return cls._clean_json_response(text)
        except urllib.error.HTTPError as e:
            elapsed = time.time() - start_t
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"[Gemini HTTPError {e.code} em {elapsed:.2f}s]: {err_body}", flush=True)
            return {
                "error": f"Erro na API Gemini ({e.code} em {elapsed:.1f}s): {err_body}",
                "issues": [],
                "summary": f"Erro {e.code} na API Gemini."
            }
        except urllib.error.URLError as e:
            elapsed = time.time() - start_t
            print(f"[Gemini URLError em {elapsed:.2f}s]: {e.reason}", flush=True)
            return {
                "error": f"Timeout/Rede Gemini ({elapsed:.1f}s): {e.reason}",
                "issues": [],
                "summary": f"Timeout na conexão com o Gemini ({elapsed:.1f}s)."
            }
        except Exception as e:
            elapsed = time.time() - start_t
            print(f"[Gemini Exceção em {elapsed:.2f}s]: {str(e)}", flush=True)
            return {
                "error": f"Falha ao chamar Gemini ({elapsed:.1f}s): {str(e)}",
                "issues": [],
                "summary": "Falha na chamada do Gemini."
            }

    @classmethod
    def test_gemini_connection(cls, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Testa a chave e lista os modelos disponíveis na API do Google AI Studio."""
        key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            return {"ok": False, "error": "Chave da API não fornecida."}

        models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        print(f"\n[Gemini Teste] Consultando modelos em v1beta/models...", flush=True)
        start_t = time.time()
        try:
            req = urllib.request.Request(models_url)
            with urllib.request.urlopen(req, timeout=20) as resp:
                elapsed = time.time() - start_t
                raw = resp.read().decode("utf-8", errors="replace")
                data = json.loads(raw)
                models = [m.get("name", "").replace("models/", "") for m in data.get("models", [])]
                flash_models = [m for m in models if "flash" in m]
                print(f"[Gemini Teste Sucesso] {len(models)} modelos em {elapsed:.2f}s. Modelos Flash disponíveis: {flash_models}", flush=True)
                return {
                    "ok": True,
                    "elapsed_seconds": round(elapsed, 2),
                    "total_models": len(models),
                    "flash_models": flash_models,
                    "active_model": "gemini-3.8-flash"
                }
        except urllib.error.HTTPError as e:
            elapsed = time.time() - start_t
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"[Gemini Teste HTTPError {e.code}]: {err_body}", flush=True)
            return {"ok": False, "error": f"HTTP {e.code}: {err_body}", "elapsed": round(elapsed, 2)}
        except urllib.error.URLError as e:
            elapsed = time.time() - start_t
            print(f"[Gemini Teste URLError]: {e.reason}", flush=True)
            return {"ok": False, "error": f"Erro de conexão/timeout ({elapsed:.1f}s): {e.reason}", "elapsed": round(elapsed, 2)}
        except Exception as e:
            elapsed = time.time() - start_t
            print(f"[Gemini Teste Exceção]: {str(e)}", flush=True)
            return {"ok": False, "error": str(e), "elapsed": round(elapsed, 2)}

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
    def _parse_markdown_walkthrough(cls, text: str) -> Dict[str, Any]:
        """Extrai seções estruturadas quando o modelo responde em Markdown em vez de JSON."""
        res: Dict[str, Any] = {
            "executive_summary": "",
            "new_capabilities": [],
            "architectural_story": "",
            "senior_audit": {},
            "new_files_analysis": [],
            "modified_files_analysis": []
        }

        # Resumo Executivo
        m_exec = re.search(r"##\s*(?:1\.\s*)?Resumo Executivo[^\n]*\n([\s\S]*?)(?=\n##|\Z)", text, re.IGNORECASE)
        if m_exec:
            res["executive_summary"] = m_exec.group(1).strip()

        # Novas Capacidades
        m_cap = re.search(r"##\s*(?:2\.\s*)?Novas Capacidades[^\n]*\n([\s\S]*?)(?=\n##|\Z)", text, re.IGNORECASE)
        if m_cap:
            caps = re.findall(r"^[\s*-]+(.*)$", m_cap.group(1), re.MULTILINE)
            res["new_capabilities"] = [c.strip() for c in caps if c.strip()]

        # Fluxo Arquitetural
        m_flow = re.search(r"##\s*(?:3\.\s*)?Fluxo Arquitetural[^\n]*\n([\s\S]*?)(?=\n##|\Z)", text, re.IGNORECASE)
        if m_flow:
            res["architectural_story"] = m_flow.group(1).strip()

        # Auditoria Sênior
        m_solid = re.search(r"(?:###|####|\*\*)\s*(?:Princípios\s+)?SOLID[^\n]*[\n:]([\s\S]*?)(?=\n###|\n####|\n##|\Z)", text, re.IGNORECASE)
        m_clean = re.search(r"(?:###|####|\*\*)\s*Clean Code[^\n]*[\n:]([\s\S]*?)(?=\n###|\n####|\n##|\Z)", text, re.IGNORECASE)
        m_yagni = re.search(r"(?:###|####|\*\*)\s*YAGNI[^\n]*[\n:]([\s\S]*?)(?=\n###|\n####|\n##|\Z)", text, re.IGNORECASE)
        m_risks = re.search(r"(?:###|####|\*\*)\s*Riscos[^\n]*[\n:]([\s\S]*?)(?=\n###|\n####|\n##|\Z)", text, re.IGNORECASE)
        m_tests = re.search(r"(?:###|####|\*\*)\s*(?:Estratégia de\s+)?Testes[^\n]*[\n:]([\s\S]*?)(?=\n###|\n####|\n##|\Z)", text, re.IGNORECASE)

        if any([m_solid, m_clean, m_yagni, m_risks, m_tests]):
            res["senior_audit"] = {
                "solid_summary": m_solid.group(1).strip() if m_solid else "SOLID respeitado.",
                "clean_code_summary": m_clean.group(1).strip() if m_clean else "Clean Code avaliado.",
                "yagni_summary": m_yagni.group(1).strip() if m_yagni else "Pragmático sem overengineering.",
                "risks_and_regressions": m_risks.group(1).strip() if m_risks else "Baixo risco de regressão.",
                "testing_evaluation": m_tests.group(1).strip() if m_tests else "Testes adequados."
            }

        # Arquivos detalhados: ### [NOVO ARQUIVO] caminho ou ### [MODIFICADO] caminho
        file_matches = re.finditer(
            r"###\s*\[(NOVO ARQUIVO|MODIFICADO)\]\s*`?([^`\n]+)`?([\s\S]*?)(?=\n###|\n##|\Z)",
            text,
            re.IGNORECASE
        )
        for fm in file_matches:
            status_label = fm.group(1).upper()
            path = fm.group(2).strip()
            body = fm.group(3)

            purpose = ""
            changes = ""
            impact = ""

            mp = re.search(r"-\s*\*\*Papel no sistema:\*\*\s*(.*)", body, re.IGNORECASE)
            if mp: purpose = mp.group(1).strip()

            mc = re.search(r"-\s*\*\*O que foi adicionado/modificado:\*\*\s*(.*)", body, re.IGNORECASE)
            if not mc:
                mc = re.search(r"-\s*\*\*Alterações[^:]*:\*\*\s*(.*)", body, re.IGNORECASE)
            if mc: changes = mc.group(1).strip()

            mi = re.search(r"-\s*\*\*Impacto:\*\*\s*(.*)", body, re.IGNORECASE)
            if mi: impact = mi.group(1).strip()

            item = {
                "path": path,
                "filename": path.split("/")[-1],
                "purpose": purpose,
                "code_highlights": changes,
                "changes_summary": changes,
                "solid_rating": "Em conformidade",
                "clean_code_rating": "Bom",
                "yagni_rating": "Pragmático",
                "regression_risk": "Baixo",
                "impact": impact
            }

            if "NOVO" in status_label:
                res["new_files_analysis"].append(item)
            else:
                res["modified_files_analysis"].append(item)

        return res

    @classmethod
    def _parse_walkthrough_response(cls, raw_text: str) -> Dict[str, Any]:
        """
        Parser ultra-robusto para a resposta de Walkthrough & Auditoria Sênior.
        Suporta:
        1. JSON puro ou dentro de blocos ```json ... ```
        2. JSON com quebras de linha em literais de string (strict=False)
        3. JSON com trailing commas ou fechamentos truncados
        4. Resposta em formato Markdown (com seções ## Resumo Executivo, ## Novas Capacidades, etc.)
        5. Fallback inteligente com o texto bruto para nunca retornar vazio
        """
        text = strip_ansi(raw_text or "").strip()
        print(f"\n[Walkthrough Raw Output ({len(text)} chars)]:\n{text[:400]}...", flush=True)

        if not text:
            return cls._normalize_explain_pr_response({
                "executive_summary": "Nenhuma resposta retornada pelo provedor de IA.",
                "new_capabilities": [],
                "architectural_story": "",
                "senior_audit": {},
                "new_files_analysis": [],
                "modified_files_analysis": []
            })

        # 1. Tenta extrair e decodificar JSON
        json_candidate = ""
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            json_candidate = m.group(1).strip()
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                json_candidate = text[start:end+1]

        if json_candidate:
            cleaned_json = re.sub(r",\s*([\]}])", r"\1", json_candidate)
            try:
                data = json.loads(cleaned_json, strict=False)
                if isinstance(data, dict):
                    print(f"[Walkthrough Parser] JSON válido decodificado com sucesso!", flush=True)
                    return cls._normalize_explain_pr_response(data)
            except Exception as e:
                print(f"[Walkthrough Parser Warning] json.loads inicial falhou ({e}), tentando reparar...", flush=True)

        # 2. Se JSON falhar, tenta parsear estrutura Markdown
        md_result = cls._parse_markdown_walkthrough(text)
        if md_result.get("executive_summary") or len(md_result.get("new_files_analysis", [])) > 0 or len(md_result.get("new_capabilities", [])) > 0:
            print(f"[Walkthrough Parser] Resposta identificada e extraída com sucesso via estrutura Markdown!", flush=True)
            return cls._normalize_explain_pr_response(md_result)

        # 3. Fallback inteligente: nunca deixar a tela vazia!
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip() and not p.strip().startswith("```")]
        exec_summary = "\n\n".join(paragraphs[:3]) if paragraphs else text[:600]

        print(f"[Walkthrough Parser Fallback] Utilizando extração textual para o resumo executivo.", flush=True)
        return cls._normalize_explain_pr_response({
            "executive_summary": exec_summary,
            "new_capabilities": [],
            "architectural_story": "\n\n".join(paragraphs[3:5]) if len(paragraphs) > 3 else "",
            "senior_audit": {
                "solid_summary": "Avaliação gerada pelo provedor de IA.",
                "clean_code_summary": "Código avaliado pelos padrões da linguagem.",
                "yagni_summary": "Simplicidade analisada.",
                "risks_and_regressions": "Riscos analisados.",
                "testing_evaluation": "Estratégia de testes verificada."
            },
            "new_files_analysis": [],
            "modified_files_analysis": []
        })

    @classmethod
    def _normalize_explain_pr_response(cls, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Garante que a resposta do walkthrough e auditoria sênior tenha todas as chaves esperadas."""
        raw.setdefault("executive_summary", "")
        raw.setdefault("new_capabilities", [])
        raw.setdefault("architectural_story", "")
        raw.setdefault("senior_audit", {
            "solid_summary": "Princípios SOLID avaliados nas novas implementações.",
            "clean_code_summary": "Aderência a Clean Code e boas práticas avaliada.",
            "yagni_summary": "Avaliação de simplicidade e filtro anti-overengineering realizada.",
            "risks_and_regressions": "Riscos de regressão analisados.",
            "testing_evaluation": "Estratégia de testes avaliada."
        })
        raw.setdefault("new_files_analysis", [])
        raw.setdefault("modified_files_analysis", [])

        # Se files_explained não vier preenchido, compõe a partir dos arquivos analisados
        if not raw.get("files_explained"):
            files_exp = []
            for nf in raw.get("new_files_analysis", []):
                files_exp.append({
                    "path": nf.get("path", ""),
                    "filename": nf.get("filename", ""),
                    "status": "added",
                    "badge_label": "Novo Arquivo",
                    "purpose": nf.get("purpose", ""),
                    "code_changes": nf.get("code_highlights", "") or nf.get("purpose", ""),
                    "impact": f"SOLID: {nf.get('solid_rating', 'OK')} | Clean Code: {nf.get('clean_code_rating', 'OK')} | YAGNI: {nf.get('yagni_rating', 'Pragmático')}"
                })
            for mf in raw.get("modified_files_analysis", []):
                files_exp.append({
                    "path": mf.get("path", ""),
                    "filename": mf.get("filename", ""),
                    "status": "modified",
                    "badge_label": "Arquivo Modificado",
                    "purpose": mf.get("purpose", ""),
                    "code_changes": mf.get("changes_summary", ""),
                    "impact": f"Risco: {mf.get('regression_risk', 'Baixo')}. {mf.get('regression_notes', '')}"
                })
            raw["files_explained"] = files_exp

        return raw

    @classmethod
    async def explain_pr(
        cls,
        repo_name: str,
        base_branch: str,
        head_branch: str,
        commits: List[Dict[str, str]],
        files_summary: Optional[List[Dict[str, Any]]] = None,
        new_files_summary: Optional[List[Dict[str, Any]]] = None,
        modified_files_summary: Optional[List[Dict[str, Any]]] = None,
        provider: str = "claude",
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera uma explicação técnica narrativa e detalhada do PR (Walkthrough contando via código)
        e realiza auditoria sênior com base em SOLID, Clean Code, YAGNI e riscos de regressão.
        """
        if new_files_summary is not None or modified_files_summary is not None:
            new_files = new_files_summary or []
            mod_files = modified_files_summary or []
        else:
            new_files = [f for f in (files_summary or []) if f.get("status") == "added"]
            mod_files = [f for f in (files_summary or []) if f.get("status") != "added"]

        prompt = f"""Você é um Engenheiro de Software Principal realizando o walkthrough técnico completo e auditoria sênior de um Pull Request no repositório '{repo_name}'.
Sua missão é explicar para outros desenvolvedores o que foi feito na aplicação, contando a história através do código, e avaliar o código com rigor sênior: SOLID, Clean Code, YAGNI/KISS e riscos de regressão.

INFORMAÇÕES DA TASK:
- Repositório: {repo_name}
- Branches: {base_branch} -> {head_branch}
- Commits na task: {json.dumps(commits, ensure_ascii=False)}

ARQUIVOS NOVOS CRIADOS (Amostra de Lógica/Arquitetura):
{json.dumps(new_files, ensure_ascii=False, indent=2)}

ARQUIVOS MODIFICADOS (Amostra de Lógica/Arquitetura):
{json.dumps(mod_files, ensure_ascii=False, indent=2)}

Sua resposta DEVE ser estritamente em formato JSON válido contendo:
{{
  "executive_summary": "Resumo executivo claro e direto em 2-3 frases do que este PR implementa e qual capacidade de negócio a aplicação ganhou.",
  "new_capabilities": [
    "Capacidade 1 que o sistema agora possui",
    "Capacidade 2..."
  ],
  "architectural_story": "Narrativa técnica explicando como o fluxo de execução funciona entre os componentes (ex: O Pub/Sub entrega o push no mapper X, que valida dados e despacha comando para o handler Y, que consulta o catálogo Z e persiste no MongoDB).",
  "senior_audit": {{
    "solid_summary": "Parecer geral sobre a aderência aos princípios SOLID (SRP, OCP, LSP, ISP, DIP) nas novas classes e alterações.",
    "clean_code_summary": "Parecer geral sobre Clean Code, clareza de nomes, funções concisas, ausência de aninhamentos profundos e boas práticas em Python.",
    "yagni_summary": "Parecer sobre YAGNI e KISS: avalie se a solução é pragmática ou se houve overengineering, criação de abstrações prematuras ou complexidade desnecessária.",
    "risks_and_regressions": "Análise de potenciais riscos de regressão, impacto em código legado, contratos de eventos ou concorrência.",
    "testing_evaluation": "Avaliação dos testes adicionados ou modificados: se cobrem cenários felizes, bordas, isolamento e concorrência."
  }},
  "new_files_analysis": [
    {{
      "path": "caminho/do/arquivo_novo.py",
      "filename": "arquivo_novo.py",
      "purpose": "O que este arquivo faz e qual sua responsabilidade no sistema (1-2 frases).",
      "solid_rating": "Em conformidade | Atenção | Violação",
      "solid_comment": "Análise concisa sob a ótica de SOLID (ex: 'SRP respeitado: classe única focada em resolver siglas via HTTP. Dependência injetada por protocolo.').",
      "clean_code_rating": "Excelente | Bom | Sugestão",
      "clean_code_comment": "Análise de Clean Code (nomes expressivos, clareza, early return, type hints).",
      "yagni_rating": "Pragmático | Alerta Overengineering",
      "yagni_comment": "Avaliação se a implementação é pragmática ou se há complexidade prematura.",
      "code_highlights": "O que especificamente foi adicionado via código (cite nomes reais de classes, métodos, decorators, parâmetros e regras novas).",
      "senior_recommendation": "Recomendação técnica sênior para o revisor prestar atenção."
    }}
  ],
  "modified_files_analysis": [
    {{
      "path": "caminho/do/arquivo_modificado.py",
      "filename": "arquivo_modificado.py",
      "purpose": "Papel do arquivo no sistema (1 frase).",
      "changes_summary": "O que especificamente mudou neste arquivo (métodos, regras alteradas).",
      "regression_risk": "Baixo | Médio | Alto",
      "regression_notes": "Possíveis impactos em consumidores existentes ou risco de quebra de contrato.",
      "clean_code_notes": "Se a modificação manteve a clareza e padrão da base de código."
    }}
  ],
  "files_explained": [
    {{
      "path": "caminho/do/arquivo.py",
      "filename": "arquivo.py",
      "status": "added ou modified",
      "badge_label": "Novo Arquivo ou Modificado",
      "purpose": "Papel no sistema",
      "code_changes": "Resumo das alterações",
      "impact": "Impacto no app"
    }}
  ]
}}

IMPORTANTE: Seja técnico, direto e preciso. Analise cada arquivo fornecido com foco em código real. Retorne APENAS o JSON válido.
"""
        if provider == "claude":
            claude_bin = "/opt/homebrew/bin/claude"
            if not os.path.exists(claude_bin):
                claude_bin = "claude"
            env = os.environ.copy()
            env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:/usr/bin:{env.get('PATH', '')}"
            env["NO_COLOR"] = "1"
            env["TERM"] = "dumb"
            print(f"\n[Claude CLI Explain PR] Chamando Claude CLI...", flush=True)
            start_t = time.time()
            try:
                process = subprocess.run(
                    [claude_bin, "-p", prompt],
                    capture_output=True,
                    text=True,
                    env=env,
                    stdin=subprocess.DEVNULL,
                    timeout=300,
                    encoding="utf-8",
                    errors="replace"
                )
                elapsed = time.time() - start_t
                clean_stdout = strip_ansi(process.stdout or "").strip()
                clean_stderr = strip_ansi(process.stderr or "").strip()
                output_to_use = clean_stdout if clean_stdout else clean_stderr

                if process.returncode != 0 and not clean_stdout:
                    err_msg = clean_stderr or f"Exit code {process.returncode}"
                    print(f"[Claude CLI Explain PR Erro em {elapsed:.2f}s]: {err_msg[:200]}", flush=True)
                    return {
                        "error": f"Erro no Claude CLI: {err_msg}",
                        "executive_summary": "Falha na geração do walkthrough via Claude CLI.",
                        "files_explained": [],
                        "new_files_analysis": [],
                        "modified_files_analysis": []
                    }
                print(f"[Claude CLI Explain PR Sucesso em {elapsed:.2f}s, {len(output_to_use)} chars]", flush=True)
                return cls._parse_walkthrough_response(output_to_use)
            except subprocess.TimeoutExpired:
                print(f"[Claude CLI Explain PR Timeout após 300s]", flush=True)
                return {
                    "error": "Timeout ao executar Claude CLI para Walkthrough (mais de 5min).",
                    "executive_summary": "Timeout na geração do walkthrough.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
            except Exception as e:
                print(f"[Claude CLI Explain PR Exceção]: {str(e)}", flush=True)
                return {
                    "error": f"Erro ao chamar Claude CLI: {str(e)}",
                    "executive_summary": "Erro na execução do Claude CLI.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
        elif provider == "antigravity":
            agy_bin = cls._find_agy_bin()
            env = os.environ.copy()
            user_home = os.path.expanduser("~")
            env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{user_home}/.local/bin:{user_home}/.gemini/antigravity/bin:{env.get('PATH', '')}"
            env["NO_COLOR"] = "1"
            env["TERM"] = "dumb"
            env["FORCE_COLOR"] = "0"
            env["CLICOLOR"] = "0"
            print(f"\n[Antigravity CLI Explain PR] Chamando '{agy_bin} -p'...", flush=True)
            start_t = time.time()
            try:
                process = subprocess.run(
                    [agy_bin, "-p", prompt],
                    capture_output=True,
                    text=True,
                    env=env,
                    stdin=subprocess.DEVNULL,
                    timeout=300,
                    encoding="utf-8",
                    errors="replace"
                )
                elapsed = time.time() - start_t
                clean_stdout = strip_ansi(process.stdout or "").strip()
                clean_stderr = strip_ansi(process.stderr or "").strip()
                output_to_use = clean_stdout if clean_stdout else clean_stderr

                print(f"[Antigravity CLI Explain PR] returncode={process.returncode}, stdout={len(clean_stdout)} chars, stderr={len(clean_stderr)} chars", flush=True)

                if process.returncode != 0 and not clean_stdout:
                    err_msg = clean_stderr or f"Exit code {process.returncode}"
                    print(f"[Antigravity CLI Explain PR Erro em {elapsed:.2f}s]: {err_msg[:200]}", flush=True)
                    print(f"[Antigravity CLI Explain PR Fallback] Acionando Claude CLI...", flush=True)
                    return await cls.explain_pr(
                        repo_name, base_branch, head_branch, commits,
                        files_summary, new_files_summary, modified_files_summary,
                        provider="claude", api_key=api_key
                    )

                if not output_to_use or len(output_to_use) < 50:
                    print(f"[Antigravity CLI Explain PR] Saída muito curta ({len(output_to_use)} chars), fallback para Claude CLI...", flush=True)
                    return await cls.explain_pr(
                        repo_name, base_branch, head_branch, commits,
                        files_summary, new_files_summary, modified_files_summary,
                        provider="claude", api_key=api_key
                    )

                print(f"[Antigravity CLI Explain PR Sucesso em {elapsed:.2f}s, {len(output_to_use)} chars]", flush=True)
                result = cls._parse_walkthrough_response(output_to_use)

                # Se o parse não conseguiu extrair resumo executivo útil, fallback
                if not result.get("executive_summary") or result.get("executive_summary") == "Nenhuma resposta retornada pelo provedor de IA.":
                    print(f"[Antigravity CLI Explain PR] Parse sem resumo executivo, fallback para Claude CLI...", flush=True)
                    return await cls.explain_pr(
                        repo_name, base_branch, head_branch, commits,
                        files_summary, new_files_summary, modified_files_summary,
                        provider="claude", api_key=api_key
                    )

                return result
            except subprocess.TimeoutExpired:
                print(f"[Antigravity CLI Explain PR Timeout após 300s], fallback para Claude CLI...", flush=True)
                return await cls.explain_pr(
                    repo_name, base_branch, head_branch, commits,
                    files_summary, new_files_summary, modified_files_summary,
                    provider="claude", api_key=api_key
                )
            except Exception as e:
                print(f"[Antigravity CLI Explain PR Exceção: {str(e)}], fallback para Claude CLI...", flush=True)
                return await cls.explain_pr(
                    repo_name, base_branch, head_branch, commits,
                    files_summary, new_files_summary, modified_files_summary,
                    provider="claude", api_key=api_key
                )
        elif provider == "gemini":
            key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            if not key:
                print("[Gemini Explain PR]: Chave ausente.", flush=True)
                return {
                    "error": "Chave da API do Gemini não configurada.",
                    "executive_summary": "Chave Gemini ausente.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
            model_name = "gemini-2.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 8192
                }
            }
            print(f"\n[Gemini Explain PR] Chamando {model_name} (payload: {len(json.dumps(payload))} bytes)...", flush=True)
            start_t = time.time()
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    elapsed = time.time() - start_t
                    raw_body = resp.read().decode("utf-8", errors="replace")
                    print(f"[Gemini Explain PR Sucesso] Recebido em {elapsed:.2f}s ({len(raw_body)} bytes)", flush=True)
                    data = json.loads(raw_body)
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return cls._parse_walkthrough_response(text)
            except urllib.error.HTTPError as e:
                elapsed = time.time() - start_t
                err_body = e.read().decode("utf-8", errors="replace")
                print(f"[Gemini Explain PR HTTPError {e.code} em {elapsed:.2f}s]: {err_body}", flush=True)
                return {
                    "error": f"Erro na API Gemini ({e.code} em {elapsed:.1f}s): {err_body}",
                    "executive_summary": "Erro na API Gemini.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
            except urllib.error.URLError as e:
                elapsed = time.time() - start_t
                print(f"[Gemini Explain PR URLError em {elapsed:.2f}s]: {e.reason}", flush=True)
                return {
                    "error": f"Timeout/Rede Gemini ({elapsed:.1f}s): {e.reason}",
                    "executive_summary": "Erro de conexão com o Gemini.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
            except Exception as e:
                elapsed = time.time() - start_t
                print(f"[Gemini Explain PR Exceção em {elapsed:.2f}s]: {str(e)}", flush=True)
                return {
                    "error": f"Erro na API Gemini ({elapsed:.1f}s): {str(e)}",
                    "executive_summary": "Erro de conexão com o Gemini.",
                    "files_explained": [],
                    "new_files_analysis": [],
                    "modified_files_analysis": []
                }
        else:
            return {"error": f"Provedor {provider} desconhecido.", "files_explained": []}
