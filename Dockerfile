FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
EXPOSE 4173
CMD ["node","server/main.ts"]
