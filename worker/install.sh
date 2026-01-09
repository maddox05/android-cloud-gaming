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

# Detect distribution and package manager
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        DISTRO_LIKE=$ID_LIKE
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
    elif [ -f /etc/arch-release ]; then
        DISTRO="arch"
    else
        DISTRO="unknown"
    fi

    # Determine package manager
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

    echo "Detected distribution: $DISTRO (package manager: $PKG_MANAGER)"
}

# Update system packages
update_system() {
    echo "Updating system packages..."
    case $PKG_MANAGER in
        apt)
            sudo apt-get update
            sudo apt-get upgrade -y
            ;;
        dnf)
            sudo dnf upgrade -y --refresh
            ;;
        yum)
            sudo yum update -y
            ;;
        pacman)
            sudo pacman -Syu --noconfirm
            ;;
    esac
}

# Install packages (handles different package names per distro)
install_packages() {
    echo "Installing packages: $@"
    case $PKG_MANAGER in
        apt)
            sudo apt-get install -y "$@"
            ;;
        dnf)
            sudo dnf install -y "$@"
            ;;
        yum)
            sudo yum install -y "$@"
            ;;
        pacman)
            sudo pacman -S --noconfirm --needed "$@"
            ;;
    esac
}

# Install prerequisites based on distro
install_prerequisites() {
    echo "Installing prerequisites..."
    case $PKG_MANAGER in
        apt)
            install_packages ca-certificates curl gnupg lsb-release wget git unzip
            ;;
        dnf|yum)
            install_packages ca-certificates curl gnupg2 wget git unzip
            ;;
        pacman)
            install_packages ca-certificates curl gnupg wget git unzip
            ;;
    esac
}

# Install Docker based on distro
install_docker() {
    echo "Installing Docker..."
    if command -v docker &> /dev/null; then
        echo "Docker is already installed."
        return
    fi

    case $PKG_MANAGER in
        apt)
            # Add Docker's official GPG key
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$DISTRO/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg

            # Set up the repository
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DISTRO \
              $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

            # Install Docker Engine
            sudo apt-get update
            install_packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        dnf)
            # Add Docker repo for Fedora/RHEL
            sudo dnf -y install dnf-plugins-core
            if [ "$DISTRO" = "fedora" ]; then
                sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            else
                sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
            fi
            install_packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        yum)
            # Add Docker repo for CentOS/older RHEL
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            install_packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        pacman)
            install_packages docker docker-compose
            ;;
    esac

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed successfully. You may need to log out and back in for group changes to take effect."
}

# Install ADB based on distro
install_adb() {
    echo "Installing ADB..."
    case $PKG_MANAGER in
        apt)
            install_packages android-tools-adb android-tools-fastboot
            ;;
        dnf|yum)
            install_packages android-tools
            ;;
        pacman)
            install_packages android-tools
            ;;
    esac
}

# Install kernel modules based on distro
install_kernel_modules() {
    echo "Installing kernel extra modules..."
    KERNEL_VERSION=$(uname -r)
    case $PKG_MANAGER in
        apt)
            install_packages linux-modules-extra-${KERNEL_VERSION} || echo "Extra modules package not available for this kernel"
            ;;
        dnf|yum)
            install_packages kernel-modules-extra || echo "Extra modules package not available for this kernel"
            ;;
        pacman)
            echo "Arch typically includes all kernel modules by default"
            ;;
    esac
}

echo "Starting Android Cloud Gaming Server Setup..."

# Detect distro and package manager
detect_distro

# Run installation steps
update_system
install_prerequisites
install_docker
install_adb
install_kernel_modules

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

# Enable and start Docker service
echo "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "============================================"
echo "Installation completed successfully!"
echo "============================================"

