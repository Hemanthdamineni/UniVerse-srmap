# Build context is the repo root (see docker-compose.ingress.yml), not
# ./infra, so this image can build Frontend/ directly and bake the compiled
# dist/ in rather than relying on a bind mount from the host checkout.
FROM node:22-alpine AS build

WORKDIR /app

COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci

COPY Frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/nginx/bootstrap-tls.sh /usr/local/bin/bootstrap-tls
RUN chmod 0755 /usr/local/bin/bootstrap-tls

ENTRYPOINT ["/usr/local/bin/bootstrap-tls"]
