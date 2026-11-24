FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p public/uploads && chown -R node:node /app
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:${PORT:-8080}/healthz || exit 1
CMD ["node", "server.js"]
