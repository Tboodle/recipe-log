#!/usr/bin/env bash
# dev.sh — start recipe-log for local development
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}==>${NC} $*"; }

# ── Python 3.12+ ────────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3.13 python3.12 python3; do
  if command -v "$cmd" &>/dev/null; then
    ok=$("$cmd" -c "import sys; print(sys.version_info >= (3, 12))" 2>/dev/null)
    if [ "$ok" = "True" ]; then PYTHON="$cmd"; break; fi
  fi
done
[ -z "$PYTHON" ] && { echo "Error: Python 3.12+ required (brew install python@3.13)"; exit 1; }

# ── Backend venv ─────────────────────────────────────────────────────────────
if [ ! -d "$BACKEND/.venv" ]; then
  log "Creating Python venv with $PYTHON..."
  "$PYTHON" -m venv "$BACKEND/.venv"
fi

# ── Backend dependencies ──────────────────────────────────────────────────────
if ! "$BACKEND/.venv/bin/python" -c "import fastapi" &>/dev/null; then
  log "Installing backend dependencies..."
  "$BACKEND/.venv/bin/pip" install --quiet \
    "fastapi>=0.115.0" "uvicorn[standard]>=0.30.0" \
    "sqlalchemy[asyncio]>=2.0.0" "asyncpg>=0.29.0" \
    "alembic>=1.13.0" "python-jose[cryptography]>=3.3.0" \
    "bcrypt>=4.0.0" "authlib>=1.3.0" "httpx>=0.27.0" \
    "python-multipart>=0.0.9" "pydantic-settings>=2.3.0" \
    "pydantic[email]>=2.0.0" "recipe-scrapers>=14.0.0" \
    "beautifulsoup4>=4.12.0" "pytesseract>=0.3.10" \
    "Pillow>=10.0.0" "isodate>=0.6.1" \
    "pytest>=8.0.0" "pytest-asyncio>=0.23.0" "pytest-cov>=5.0.0"
else
  log "Backend dependencies already installed."
fi

# ── Backend .env ─────────────────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  warn "Creating backend/.env with local defaults..."
  cat > "$BACKEND/.env" <<EOF
DATABASE_URL=postgresql+asyncpg://${USER}@localhost:5432/recipedb
JWT_SECRET=dev-secret-change-in-production
PARSER_BACKEND=local
EOF
fi

# ── Database migrations ───────────────────────────────────────────────────────
log "Running database migrations..."
(cd "$BACKEND" && .venv/bin/alembic upgrade head)

# ── Frontend dependencies ─────────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  log "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)
else
  log "Frontend dependencies already installed."
fi

# ── Port check ────────────────────────────────────────────────────────────────
API_PORT=8000
while lsof -ti:"$API_PORT" &>/dev/null; do
  OWNER=$(lsof -ti:"$API_PORT" | xargs ps -o comm= -p 2>/dev/null | head -1)
  warn "Port $API_PORT is in use by: $OWNER"
  API_PORT=$((API_PORT + 1))
  warn "Trying port $API_PORT instead..."
done

# Update Vite proxy if port changed from default
if [ "$API_PORT" != "8000" ]; then
  warn "Updating Vite proxy to target port $API_PORT..."
  sed -i '' "s|target: \"http://127.0.0.1:[0-9]*\"|target: \"http://127.0.0.1:$API_PORT\"|" \
    "$FRONTEND/vite.config.ts"
fi

# ── Start both servers ────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}API:${NC}      http://127.0.0.1:${API_PORT}/docs"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

trap 'kill 0' INT TERM

(cd "$BACKEND" && .venv/bin/uvicorn app.main:app --reload --port "$API_PORT") &
(cd "$FRONTEND" && npm run dev) &

wait
