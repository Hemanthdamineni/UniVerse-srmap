# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

# Build the application through package scripts so local binaries resolve.
RUN npm run build

# ============================================================
# Stage 2: Serve
# ============================================================
FROM nginx:alpine

# Copy built assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Inline minimal nginx config
# - Serves static files from /usr/share/nginx/html
# - Falls back to index.html for SPA client-side routing
# - Compresses text-based assets on the fly
# - Sets reasonable cache headers
RUN { \
      echo 'server {'; \
      echo '    listen       80;'; \
      echo '    server_name  localhost;'; \
      echo '    root   /usr/share/nginx/html;'; \
      echo '    index  index.html;'; \
      echo ''; \
      echo '    # gzip compression'; \
      echo '    gzip on;'; \
      echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;'; \
      echo '    gzip_min_length 256;'; \
      echo ''; \
      echo '    # Cache static assets with hashed filenames'; \
      echo '    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff2?|ttf|eot)$ {'; \
      echo '        expires 1y;'; \
      echo '        add_header Cache-Control "public, immutable";'; \
      echo '        add_header X-Content-Type-Options nosniff;'; \
      echo '        try_files $uri =404;'; \
      echo '    }'; \
      echo ''; \
      echo '    # SPA fallback — serve index.html for all other routes'; \
      echo '    location / {'; \
      echo '        try_files $uri $uri/ /index.html;'; \
      echo '    }'; \
      echo '}'; \
    } > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
