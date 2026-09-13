# Build context is the repo root (see docker-compose.yml), not Backend/,
# so this image can also ship the Scraper/ sibling directory. The app is
# rooted at /Backend rather than the usual /app, and Scraper is copied to
# /Scraper alongside it, mirroring the repo's own Backend/ + Scraper/
# layout exactly — both the career scraper supervisor
# (Backend/src/services/career/careerScraperSupervisor.js, which walks up
# from its own source file to find Scraper/) and Scraper/config.py (which
# walks up from itself to find Backend/data/career.sqlite) resolve their
# paths with plain relative traversal, unchanged from local dev. Do not
# rename either directory without checking both of those path
# computations.
FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /Backend

COPY Backend/package*.json ./
RUN npm ci

COPY Backend/src ./src
COPY Backend/data ./data

RUN npx playwright install --with-deps chromium

# Career scraper runtime: its own venv (python-jobspy/pandas/playwright are
# not Node dependencies) plus its own Chromium download, since Playwright's
# Python and Node bindings each manage their own browser install.
COPY Scraper /Scraper
RUN python3 -m venv /Scraper/venv \
  && /Scraper/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /Scraper/venv/bin/pip install --no-cache-dir -r /Scraper/requirements.txt \
  && /Scraper/venv/bin/python3 -m playwright install chromium \
  && rm -rf /Scraper/logs /Scraper/__pycache__

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
