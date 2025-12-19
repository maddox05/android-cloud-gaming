#!/bin/bash
# each time I get a new server, I have to run this script to set it up (each time server dies as well, as I wont ever use storage)
# need to install scrcpy, docker, adb, redroid

set -e  # Exit on error

# Load environment variables from .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
fi

# Redroid image configuration (can be overridden via .env)
REDROID_IMAGE="${REDROID_IMAGE:-redroid/redroid}"
REDROID_TAG="${REDROID_TAG:-12.0.0_64only-latest}"

echo "Starting Android Cloud Gaming Server Setup..."

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install prerequisites
echo "Installing prerequisites..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    wget \
    git \
    unzip

# Install Docker
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed successfully. You may need to log out and back in for group changes to take effect."
else
    echo "Docker is already installed."
fi

# Install ADB (Android Debug Bridge)
echo "Installing ADB..."
sudo apt-get install -y android-tools-adb android-tools-fastboot

# Install scrcpy
echo "Installing scrcpy..."
sudo apt-get install -y scrcpy

# Install Node.js and npm
echo "Installing Node.js and npm..."
if ! command -v node &> /dev/null; then
    # Install Node.js 20.x LTS via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js $(node --version) and npm $(npm --version) installed successfully."
else
    echo "Node.js is already installed: $(node --version)"
fi

# Install tsx globally
echo "Installing tsx..."
if ! command -v tsx &> /dev/null; then
    sudo npm install -g tsx
    echo "tsx installed successfully."
else
    echo "tsx is already installed."
fi

# Install kernel modules (needed for Redroid)
echo "Installing kernel extra modules..."
KERNEL_VERSION=$(uname -r)
sudo apt-get install -y linux-modules-extra-${KERNEL_VERSION} || echo "Extra modules package not available for this kernel"

# Set up Redroid (Android in Docker)
echo "Setting up Redroid..."

# Try to load necessary kernel modules (may not be available on all systems)
echo "Attempting to load Android kernel modules..."
MODULES_LOADED=true

if sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null; then
    echo "✓ binder_linux module loaded"
    # Make it load on boot
    if ! grep -q "binder_linux" /etc/modules; then
        echo "binder_linux" | sudo tee -a /etc/modules
    fi
else
    echo "⚠ binder_linux module not available (this is common on AWS/cloud kernels)"
    MODULES_LOADED=false
fi

if sudo modprobe ashmem_linux 2>/dev/null; then
    echo "✓ ashmem_linux module loaded"
    # Make it load on boot
    if ! grep -q "ashmem_linux" /etc/modules; then
        echo "ashmem_linux" | sudo tee -a /etc/modules
    fi
else
    echo "⚠ ashmem_linux module not available (this is common on AWS/cloud kernels)"
    MODULES_LOADED=false
fi

if [ "$MODULES_LOADED" = false ]; then
    echo ""
    echo "NOTE: Android kernel modules are not available on this kernel."
    echo "Redroid will still work using Docker's privileged mode, but performance may be affected."
    echo ""
fi

# Pull Redroid Docker image
echo "Pulling Redroid Docker image: ${REDROID_IMAGE}:${REDROID_TAG}"
sudo docker pull "${REDROID_IMAGE}:${REDROID_TAG}"

# Enable and start Docker service
echo "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "============================================"
echo "Installation completed successfully!"
echo "============================================"

