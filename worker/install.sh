#!/bin/bash
# each time I get a new server, I have to run this script to set it up (each time server dies as well, as I wont ever use storage)
# need to install scrcpy, docker, adb, redroid

# MUST RUN THIS EWACH TIME SERVER IS KILLED OR STARTED NEW

set -e  # Exit on error

# Load environment variables from .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
fi

# Prompt for redroid base image version
read -p "Enter the REDROID_BASE_IMAGE_VERSION to install: " REDROID_BASE_IMAGE_VERSION
if [ -z "$REDROID_BASE_IMAGE_VERSION" ]; then
    echo "ERROR: REDROID_BASE_IMAGE_VERSION is required"
    exit 1
fi
echo "Using REDROID_BASE_IMAGE_VERSION: $REDROID_BASE_IMAGE_VERSION"

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

# # Pull Redroid Docker image
# echo "Pulling Redroid Docker image: ${REDROID_IMAGE}:${REDROID_TAG}"
# sudo docker pull "${REDROID_IMAGE}:${REDROID_TAG}"

# Set up redroid-base volume from golden image
echo "Setting up redroid-base volume..."
GOLDEN_IMAGE="$SCRIPT_DIR/redroid-base_${REDROID_BASE_IMAGE_VERSION}.tar.gz"

# Download golden image from R2 using credentials
R2_GOLDEN_IMAGE_KEY="redroid-bases/redroid-base_${REDROID_BASE_IMAGE_VERSION}.tar.gz"

if [ ! -f "$GOLDEN_IMAGE" ]; then
    # Validate required R2 env vars
    if [ -z "$CLOUDFLARE_R2_ACCESS_KEY_ID" ] || [ -z "$CLOUDFLARE_R2_SECRET_ACCESS_KEY" ] || [ -z "$CLOUDFLARE_R2_ENDPOINT" ] || [ -z "$R2_BUCKET_NAME" ]; then
        echo "ERROR: Missing R2 credentials. Please set the following in .env:"
        echo "  CLOUDFLARE_R2_ACCESS_KEY_ID"
        echo "  CLOUDFLARE_R2_SECRET_ACCESS_KEY"
        echo "  CLOUDFLARE_R2_ENDPOINT"
        echo "  R2_BUCKET_NAME"
        exit 1
    fi

    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        echo "Installing AWS CLI..."
        sudo apt-get install -y awscli
    fi

    echo "Downloading golden image from R2 (s3://$R2_BUCKET_NAME/$R2_GOLDEN_IMAGE_KEY)..."
    AWS_ACCESS_KEY_ID="$CLOUDFLARE_R2_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$CLOUDFLARE_R2_SECRET_ACCESS_KEY" \
    aws s3 cp "s3://$R2_BUCKET_NAME/$R2_GOLDEN_IMAGE_KEY" "$GOLDEN_IMAGE" \
        --endpoint-url "$CLOUDFLARE_R2_ENDPOINT"
fi

if [ -f "$GOLDEN_IMAGE" ]; then
    # Create the volume if it doesn't exist
    if ! sudo docker volume inspect redroid-base &>/dev/null; then
        echo "Creating redroid-base volume..."
        sudo docker volume create redroid-base
    else
        echo "redroid-base volume already exists, recreating..."
        sudo docker volume rm redroid-base
        sudo docker volume create redroid-base
    fi

    # Import the golden image into the volume
    echo "Importing golden image into redroid-base volume (this may take a while)..."
    sudo docker run --rm -v redroid-base:/data -v "$SCRIPT_DIR":/backup alpine sh -c "cd /data && tar xzf /backup/redroid-base_${REDROID_BASE_IMAGE_VERSION}.tar.gz"
    echo "✓ Golden image imported successfully"
else
    echo "⚠ Golden image not found at $GOLDEN_IMAGE"
    echo "  Set GOLDEN_IMAGE_URL in .env or provide the file manually."
fi

# Enable and start Docker service
echo "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "============================================"
echo "Installation completed successfully!"
echo "============================================"
