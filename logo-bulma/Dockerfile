# 1 Milyonuncu Marka: tek kapsayıcı (site + API). Bağımlılık yok, yalnız Node.js.
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY . .
RUN rm -rf tests tools deploy server/data server/test.mjs && mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/saglik >/dev/null || exit 1
CMD ["node", "server/server.mjs"]
