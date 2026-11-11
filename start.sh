#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=== Iniciando Code Review Assist ==="

# 1. Backend
cd "$DIR/backend"
if command -v poetry &> /dev/null && [ -f "pyproject.toml" ]; then
    echo "-> Instalando/verificando dependências Python com Poetry..."
    poetry install --no-interaction
    echo "-> Subindo Backend FastAPI com Poetry na porta 8000..."
    poetry run uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
else
    echo "-> Poetry não encontrado ou pyproject ausente. Usando venv/pip..."
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
    fi
    source .venv/bin/activate
    pip install -q -r requirements.txt
    echo "-> Subindo Backend FastAPI na porta 8000..."
    uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
fi

# 2. Frontend
cd "$DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "-> Instalando dependências do Frontend (npm install)..."
    npm install
fi

echo "-> Subindo Frontend Vite na porta 5173..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Code Review Assist rodando!"
echo "Acesse no navegador: http://localhost:5173"
echo "Para parar os serviços, pressione Ctrl+C"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" SIGINT SIGTERM EXIT
wait
