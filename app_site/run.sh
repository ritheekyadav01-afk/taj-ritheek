#!/usr/bin/env bash
# run.sh: start the Taj Ritheek site (Flask API on :5001, Vite site on :5173) and open it.
# Usage: bash app_site/run.sh        Stop with Ctrl+C.
set -e
cd "$(dirname "$0")"
API_PORT="${MERIDIAN_API_PORT:-5001}"
SITE_PORT="${MERIDIAN_SITE_PORT:-5173}"
export MERIDIAN_API_PORT="$API_PORT"

echo "Taj Ritheek: checking dependencies"
if ! python3 -c "import flask, mysql.connector, dotenv" 2>/dev/null; then
  echo "Installing Python packages"
  python3 -m pip install -q -r requirements.txt
fi
if [ ! -d web/node_modules ]; then
  echo "Installing site packages (first run only)"
  (cd web && npm install --no-audit --no-fund --loglevel=error)
fi

PIDS=""
cleanup() { [ -n "$PIDS" ] && kill $PIDS 2>/dev/null || true; }
trap cleanup EXIT INT TERM

python3 api/app.py &
API_PID="$!"
PIDS="$API_PID"
(cd web && exec npx vite --port "$SITE_PORT" --strictPort) &
PIDS="$PIDS $!"

echo "Waiting for the API and the site"
for i in $(seq 1 60); do
  if curl -fs "http://localhost:$SITE_PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "The API process stopped (see the error above). Port $API_PORT may be taken: try MERIDIAN_API_PORT=5002 and match it in web/vite.config.js."
elif ! curl -fs "http://localhost:$SITE_PORT/api/health" >/dev/null 2>&1; then
  echo "The API did not answer. Is MySQL running and is app/.env correct? See docs/how_to_run_site.md."
fi

URL="http://localhost:$SITE_PORT"
echo "Taj Ritheek is open at $URL  (Ctrl+C to stop)"
if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
wait
