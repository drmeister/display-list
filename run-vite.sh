#!/usr/bin/env bash
set -e

# Force Node 24.x to be used for both node and npm
export PATH="$HOME/.nvm/versions/node/v24.11.1/bin:$PATH"

cd "$HOME/Development/display-list"

# Optional: log versions for debugging
node --version
npm --version

# Start Vite dev server on fixed host/port
exec npm run dev -- --host 0.0.0.0 --port 5173
