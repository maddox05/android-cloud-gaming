#!/bin/bash
set -e

echo "=========================================="
echo "Redroid Kernel Modules Setup Script"
echo "=========================================="
echo ""
echo "WARNING: This may not work on Asahi Linux due to 16K page size."
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

# Detect package manager
if command -v dnf &> /dev/null; then
    PKG_MGR="dnf"
    INSTALL_CMD="sudo dnf install -y"
elif command -v apt &> /dev/null; then
    PKG_MGR="apt"
    INSTALL_CMD="sudo apt install -y"
elif command -v pacman &> /dev/null; then
    PKG_MGR="pacman"
    INSTALL_CMD="sudo pacman -S --noconfirm"
else
    echo "ERROR: No supported package manager found (dnf/apt/pacman)"
    exit 1
fi

echo ""
echo "[1/6] Installing build dependencies..."
echo "Using package manager: $PKG_MGR"

if [ "$PKG_MGR" = "dnf" ]; then
    $INSTALL_CMD git make gcc kernel-devel kernel-headers dkms
elif [ "$PKG_MGR" = "apt" ]; then
    $INSTALL_CMD git make gcc linux-headers-$(uname -r) dkms
elif [ "$PKG_MGR" = "pacman" ]; then
    $INSTALL_CMD git make gcc linux-headers dkms
fi

echo ""
echo "[2/6] Checking kernel version..."
echo "Running kernel: $(uname -r)"
echo "Kernel headers: $(ls /usr/src/kernels/ 2>/dev/null || ls /lib/modules/$(uname -r)/build 2>/dev/null || echo 'Not found')"

echo ""
echo "[3/6] Cloning redroid-modules repository..."
WORKDIR="/tmp/redroid-modules-build"
rm -rf "$WORKDIR"
git clone https://github.com/remote-android/redroid-modules.git "$WORKDIR"
cd "$WORKDIR"

echo ""
echo "[4/6] Building kernel modules..."
# Try the standard build first
if [ -f "Makefile" ]; then
    sudo make || {
        echo "Standard build failed, trying alternative approach..."

        # Try building individual modules
        for module in binder ashmem; do
            if [ -d "$module" ]; then
                echo "Building $module..."
                cd "$module"
                sudo make || echo "Failed to build $module"
                cd ..
            fi
        done
    }
else
    echo "No Makefile found, checking for DKMS setup..."
    if [ -f "dkms.conf" ]; then
        sudo dkms add .
        sudo dkms build -m redroid-modules -v 1.0
        sudo dkms install -m redroid-modules -v 1.0
    fi
fi

echo ""
echo "[5/6] Installing modules..."
sudo make install 2>/dev/null || echo "make install not available, trying manual install..."

# Try to install manually if make install failed
for ko in $(find . -name "*.ko" 2>/dev/null); do
    echo "Found module: $ko"
    sudo cp "$ko" /lib/modules/$(uname -r)/extra/ 2>/dev/null || \
    sudo cp "$ko" /lib/modules/$(uname -r)/kernel/drivers/android/ 2>/dev/null || \
    echo "Could not copy $ko"
done

sudo depmod -a

echo ""
echo "[6/6] Loading modules..."

# Try loading binder
echo "Loading binder_linux..."
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>&1 || {
    echo "modprobe failed, trying insmod..."
    BINDER_KO=$(find /tmp/redroid-modules-build -name "binder_linux.ko" 2>/dev/null | head -1)
    if [ -n "$BINDER_KO" ]; then
        sudo insmod "$BINDER_KO" devices="binder,hwbinder,vndbinder" || echo "insmod binder failed"
    fi
}

# Try loading ashmem
echo "Loading ashmem_linux..."
sudo modprobe ashmem_linux 2>&1 || {
    echo "modprobe failed, trying insmod..."
    ASHMEM_KO=$(find /tmp/redroid-modules-build -name "ashmem_linux.ko" 2>/dev/null | head -1)
    if [ -n "$ASHMEM_KO" ]; then
        sudo insmod "$ASHMEM_KO" || echo "insmod ashmem failed"
    fi
}

echo ""
echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""
echo "Checking loaded modules:"
lsmod | grep -E "binder|ashmem" || echo "No binder/ashmem modules loaded"

echo ""
echo "Checking /dev devices:"
ls -la /dev/binder* /dev/ashmem* /dev/binderfs 2>/dev/null || echo "No binder/ashmem devices found"

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
echo ""
echo "If modules loaded successfully, try restarting redroid:"
echo "  docker restart pod0-redroid-1"
echo ""
echo "If it failed, you may need to build a custom kernel."
echo "See: https://github.com/remote-android/redroid-modules"
