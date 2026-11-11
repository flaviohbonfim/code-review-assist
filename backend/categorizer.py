import os
import re
from typing import List, Dict, Any

class Categorizer:
    @staticmethod
    def categorize_file(file_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Categoriza o arquivo em camadas arquiteturais e identifica se é
        Mudança de Lógica ou Ruído Mecânico.
        """
        path = file_info.get("path", "").lower()
        filename = file_info.get("filename", "").lower()
        ext = file_info.get("extension", "")

        # 1. Camada Arquitetural
        layer = "Outros"
        if any(k in path for k in ["/domain/", "/services/", "/service/", "/usecases/", "/usecase/", "/core/"]):
            layer = "Domínio / Services"
        elif any(k in path for k in ["/api/", "/routers/", "/router/", "/controllers/", "/controller/", "/endpoints/", "/views/"]):
            layer = "API / Controllers / Routers"
        elif any(k in path for k in ["/models/", "/model/", "/schemas/", "/schema/", "/dtos/", "/dto/", "/entities/"]):
            layer = "Models & Schemas"
        elif any(k in path for k in ["/tests/", "/test/", "test_", "_test.", "spec."]):
            layer = "Testes"
        elif any(k in path for k in ["/migrations/", "/alembic/", "/db/", "migration", ".sql"]):
            layer = "Banco de Dados & Migrations"
        elif any(k in filename for k in ["docker", "config", "settings", ".env", "makefile"]) or ext in [".yml", ".yaml", ".toml", ".ini", ".cfg", ".json"]:
            layer = "Configuração & Infraestrutura"
        elif any(k in path for k in ["/utils/", "/util/", "/helpers/", "/helper/", "/common/", "/shared/"]):
            layer = "Utilitários & Helpers"

        # 2. Mudança de Lógica vs Ruído Mecânico
        # Ruído mecânico: lockfiles, arquivos gerados, migrations automáticas, só imports ou arquivos com 0 linhas
        is_mechanical_noise = False
        noise_reason = ""

        if filename in ["poetry.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "cargo.lock", "gemfile.lock"]:
            is_mechanical_noise = True
            noise_reason = "Arquivo de lock de dependências"
        elif "/migrations/versions/" in path or "alembic/versions" in path:
            is_mechanical_noise = True
            noise_reason = "Migration gerada automaticamente"
        elif ext in [".svg", ".png", ".jpg", ".jpeg", ".ico", ".lock"]:
            is_mechanical_noise = True
            noise_reason = "Arquivo binário ou estático"
        elif file_info.get("status") == "renamed" and file_info.get("added", 0) == 0 and file_info.get("deleted", 0) == 0:
            is_mechanical_noise = True
            noise_reason = "Renomeação pura sem alteração de código"
        elif file_info.get("added", 0) <= 2 and file_info.get("deleted", 0) <= 2 and layer == "Configuração & Infraestrutura":
            is_mechanical_noise = True
            noise_reason = "Ajuste pontual de configuração"

        return {
            **file_info,
            "layer": layer,
            "is_mechanical_noise": is_mechanical_noise,
            "noise_reason": noise_reason,
            "change_type": "noise" if is_mechanical_noise else "logic"
        }

    @classmethod
    def group_and_summarize(cls, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Agrupa arquivos por camada e gera contadores de impacto.
        """
        categorized = [cls.categorize_file(f) for f in files]

        layers: Dict[str, List[Dict[str, Any]]] = {}
        logic_count = 0
        noise_count = 0
        total_added = 0
        total_deleted = 0

        # Ordem preferencial de exibição das camadas
        layer_order = [
            "Domínio / Services",
            "API / Controllers / Routers",
            "Models & Schemas",
            "Banco de Dados & Migrations",
            "Testes",
            "Utilitários & Helpers",
            "Configuração & Infraestrutura",
            "Outros"
        ]

        for l_name in layer_order:
            layers[l_name] = []

        for f in categorized:
            l = f["layer"]
            if l not in layers:
                layers[l] = []
            layers[l].append(f)

            if f["is_mechanical_noise"]:
                noise_count += 1
            else:
                logic_count += 1
            total_added += f.get("added", 0)
            total_deleted += f.get("deleted", 0)

        # Remove camadas vazias
        filtered_layers = {k: v for k, v in layers.items() if len(v) > 0}

        return {
            "total_files": len(files),
            "logic_files_count": logic_count,
            "noise_files_count": noise_count,
            "total_added": total_added,
            "total_deleted": total_deleted,
            "layers": filtered_layers,
            "all_files": categorized
        }
