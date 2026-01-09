#!/bin/bash
# each time I get a new server, I have to run this script to set it up (each time server dies as well, as I wont ever use storage)
# need to install scrcpy, docker, adb, redroid

# MUST RUN THIS EWACH TIME SERVER IS KILLED OR STARTED NEW

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

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
else
    echo "ERROR: No supported package manager found (apt, dnf, yum, pacman)"
    exit 1
fi
echo "Detected package manager: $PKG_MANAGER"

# Universal package install helper
pkg_install() {
    case $PKG_MANAGER in
        apt)     sudo apt-get install -y "$@" ;;
        dnf)     sudo dnf install -y "$@" ;;
        yum)     sudo yum install -y "$@" ;;
        pacman)  sudo pacman -S --noconfirm --needed "$@" ;;
    esac
}

echo "Starting Android Cloud Gaming Server Setup..."

# Update system
echo "Updating system packages..."
case $PKG_MANAGER in
    apt)     sudo apt-get update && sudo apt-get upgrade -y ;;
    dnf)     sudo dnf upgrade -y --refresh ;;
    yum)     sudo yum update -y ;;
    pacman)  sudo pacman -Syu --noconfirm ;;
esac

# Install prerequisites
echo "Installing prerequisites..."
pkg_install curl wget git unzip

# Install Docker
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Try official script first, fall back to package manager
    if curl -fsSL https://get.docker.com | sudo sh 2>/dev/null; then
        echo "Docker installed via official script."
    else
        echo "Official script failed, installing from package manager..."
        case $PKG_MANAGER in
            apt)     pkg_install docker.io docker-compose ;;
            dnf)     pkg_install docker docker-compose ;;
            yum)     pkg_install docker docker-compose ;;
            pacman)  pkg_install docker docker-compose ;;
        esac
    fi
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes."
fi

# Start Docker service
echo "Starting Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

# Install ADB
echo "Installing ADB..."
case $PKG_MANAGER in
    apt)     pkg_install android-tools-adb ;;
    *)       pkg_install android-tools ;;
esac

# Install kernel extra modules (optional, may not exist)
echo "Installing kernel extra modules..."
case $PKG_MANAGER in
    apt)     pkg_install linux-modules-extra-$(uname -r) 2>/dev/null || true ;;
    dnf|yum) pkg_install kernel-modules-extra 2>/dev/null || true ;;
    pacman)  echo "Arch includes all kernel modules by default" ;;
esac

# Set up Redroid (Android in Docker)
echo "Setting up Redroid..."

# Try to load necessary kernel modules (may not be available on all systems)
echo "Attempting to load Android kernel modules..."
MODULES_LOADED=true

# Persist modules - /etc/modules-load.d/ works on all modern systemd distros
persist_module() {
    sudo mkdir -p /etc/modules-load.d
    echo "$1" | sudo tee -a /etc/modules-load.d/redroid.conf > /dev/null
}

if sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null; then
    echo "✓ binder_linux module loaded"
    grep -q "binder_linux" /etc/modules-load.d/redroid.conf 2>/dev/null || persist_module "binder_linux"
else
    echo "⚠ binder_linux module not available (common on cloud kernels)"
    MODULES_LOADED=false
fi

if sudo modprobe ashmem_linux 2>/dev/null; then
    echo "✓ ashmem_linux module loaded"
    grep -q "ashmem_linux" /etc/modules-load.d/redroid.conf 2>/dev/null || persist_module "ashmem_linux"
else
    echo "⚠ ashmem_linux module not available (common on cloud kernels)"
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

# Set up redroid-base volume from golden image
echo "Setting up redroid-base volume..."
GOLDEN_IMAGE="$SCRIPT_DIR/redroid-base.tar.gz"

# Download golden image if not present locally
GOLDEN_IMAGE_URL="${GOLDEN_IMAGE_URL:-https://pub-f7ede192a4e14fcf9bdb7f7126d9f2b4.r2.dev/redroid-bases/redroid-base.tar.gz}"

if [ ! -f "$GOLDEN_IMAGE" ] && [ -n "$GOLDEN_IMAGE_URL" ]; then
    echo "Downloading golden image from $GOLDEN_IMAGE_URL..."
    wget -O "$GOLDEN_IMAGE" "$GOLDEN_IMAGE_URL"
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
    sudo docker run --rm -v redroid-base:/data -v "$SCRIPT_DIR":/backup alpine sh -c "cd /data && tar xzf /backup/redroid-base.tar.gz"
    echo "✓ Golden image imported successfully"
else
    echo "⚠ Golden image not found at $GOLDEN_IMAGE"
    echo "  Set GOLDEN_IMAGE_URL in .env or provide the file manually."
fi

echo ""
echo "============================================"
echo "Installation completed successfully!"
echo "============================================"

