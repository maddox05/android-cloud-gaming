FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY *.ts ./
COPY tsconfig.json ./

CMD ["npx", "tsx", "main.ts"]
