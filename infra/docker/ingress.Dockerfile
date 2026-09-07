FROM nginx:1.27-alpine

RUN apk add --no-cache openssl
COPY nginx/bootstrap-tls.sh /usr/local/bin/bootstrap-tls
RUN chmod 0755 /usr/local/bin/bootstrap-tls

ENTRYPOINT ["/usr/local/bin/bootstrap-tls"]
