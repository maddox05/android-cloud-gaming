FROM node:20-slim

WORKDIR /app

COPY signal/package*.json ./
RUN npm ci

COPY signal/*.ts ./
COPY signal/tsconfig.json ./
COPY shared /shared

CMD ["npx", "tsx", "main.ts"]
