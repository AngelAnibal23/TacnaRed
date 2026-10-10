FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
# DATA_DIR apunta a /app/db, fuera de /app/data: ese directorio contiene la semilla
# data/caso.json dentro de la imagen. Montar el volumen persistente sobre /app/data
# oculta la semilla y el servidor no arranca (ENOENT: /app/data/caso.json).
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/db
RUN mkdir -p /app/db
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1
CMD ["node","server/main.ts"]
