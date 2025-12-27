FROM node:20-slim

# Install ADB, Docker CLI, and dependencies for @roamhq/wrtc native module
RUN apt-get update && apt-get install -y \
    python3 make g++ libglib2.0-dev \
    android-tools-adb \
    ca-certificates curl \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY worker/package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY worker/*.ts ./
COPY worker/tsconfig.json ./
COPY worker/assets/ ./assets/
COPY shared /shared

CMD ["npx", "tsx", "main.ts"]
