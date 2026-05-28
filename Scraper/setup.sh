#!/usr/bin/env bash
# setup.sh - One-shot setup for the Career Scraper service (Arch/Linux)
# Run from the Scraper/ directory: bash setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "==> Career Scraper Setup"
echo "    Dir: $SCRIPT_DIR"

# 1. Create venv if not present
if [ ! -d "$VENV_DIR" ]; then
    echo "==> Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
else
    echo "==> Virtual environment already exists at $VENV_DIR"
fi

# 2. Install Python dependencies
echo "==> Installing Python dependencies..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/requirements.txt" --quiet
echo "    Dependencies installed."

# 3. Install Playwright Chromium browser
echo "==> Installing Playwright Chromium browser..."
"$VENV_DIR/bin/python3" -m playwright install chromium
echo "    Playwright browser ready."

# 4. Validate imports
echo "==> Validating imports..."
"$VENV_DIR/bin/python3" -c "
import sys
sys.path.insert(0, '${SCRIPT_DIR}')
from jobspy import scrape_jobs
import pandas, schedule
from playwright.async_api import async_playwright
import config, db, normalizer, deduplicator, intelligence
from scrapers import jobspy_scraper, devfolio_scraper, unstop_scraper, internshala_scraper
print('  All imports OK')
"

echo ""
echo "==> Setup complete."
echo ""
echo "To run the scraper:"
echo "    cd $SCRIPT_DIR"
echo "    venv/bin/python3 main.py"
echo ""
echo "To run once in the background:"
echo "    nohup venv/bin/python3 main.py >> logs/scraper.log 2>&1 &"
