#!/bin/bash
# each time I get a new server, I have to run this script to set it up (each time server dies as well, as I wont ever use storage)
# need to install scrcpy, docker, adb, redroid

set -e  # Exit on error

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

# Install Go
echo "Installing Go..."
sudo snap install go --classic

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
echo "Pulling Redroid Docker image..."
sudo docker pull redroid/redroid:12.0.0-latest

# Enable and start Docker service
echo "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "============================================"
echo "Installation completed successfully!"
echo "============================================"
echo ""
echo "Installed components:"
echo "  - Docker (with Redroid image)"
echo "  - ADB (Android Debug Bridge)"
echo "  - scrcpy"
echo "  - Go (for backend worker)"
echo ""
echo "Next steps:"
echo "  1. Start Redroid container (using sudo):"
echo "     sudo docker run -itd --rm --privileged \\"
echo "       -v ~/data:/data \\"
echo "       -p 5555:5555 \\"
echo "       redroid/redroid:12.0.0-latest"
echo ""
echo "  2. Connect ADB: adb connect localhost:5555"
echo "  3. Start scrcpy: scrcpy --serial localhost:5555"
echo "  4. Build and run the worker: cd worker && go run main.go"
echo ""
echo "Troubleshooting:"
echo "  - If Redroid fails to start, check logs: sudo docker logs <container_id>"
echo "  - Ensure port 5555 is not already in use: sudo lsof -i :5555"
echo "  - For GPU acceleration, add: --device /dev/dri:/dev/dri"
echo ""