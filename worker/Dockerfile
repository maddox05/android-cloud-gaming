FROM node:20-slim

# Install ADB and dependencies for @roamhq/wrtc native module
RUN apt-get update && apt-get install -y \
    python3 make g++ libglib2.0-dev \
    android-tools-adb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY *.ts ./
COPY tsconfig.json ./
COPY assets/ ./assets/

CMD ["npx", "tsx", "main.ts"]
