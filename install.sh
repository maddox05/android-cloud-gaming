#!/bin/bash
# Setup script for Android Cloud Gaming Server
# Installs: Docker, ADB, scrcpy, Go, Node.js, tsx, and Redroid

set -e

echo "=== Android Cloud Gaming Server Setup ==="

# Update and install prerequisites
echo "Installing prerequisites..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release wget git unzip \
    android-tools-adb android-tools-fastboot

# scrcpy-server (download from GitHub releases)
echo "Installing scrcpy-server..."
SCRCPY_VERSION="3.1"
sudo mkdir -p /opt/scrcpy
sudo curl -L "https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}/scrcpy-server-v${SCRCPY_VERSION}" -o /opt/scrcpy/scrcpy-server
echo "$SCRCPY_VERSION" | sudo tee /opt/scrcpy/version > /dev/null

# Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    sudo systemctl enable docker && sudo systemctl start docker
    echo "Docker installed. Log out/in for group changes."
else
    echo "Docker already installed."
fi


# Node.js and tsx
echo "Installing Node.js and tsx..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
sudo npm install -g tsx

# Kernel modules for Redroid (optional, may not work on cloud kernels)
echo "Loading Android kernel modules..."
sudo apt-get install -y linux-modules-extra-$(uname -r) 2>/dev/null || true
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null && echo "binder_linux" | sudo tee -a /etc/modules > /dev/null || true

echo ""
echo "=== Setup Complete ==="
echo "Installed: Docker, ADB, scrcpy-server v${SCRCPY_VERSION}, Node.js, tsx"
echo ""
echo "Quick start:"
echo "  sudo docker run -itd --rm --privileged -v ~/data:/data -p 5555:5555 redroid/redroid:12.0.0-latest"
echo "  adb connect localhost:5555"
echo "  cd node && npm install && npx tsx pod/main.ts"