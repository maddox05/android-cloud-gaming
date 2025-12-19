#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Setting up Local Kubernetes Development Environment ===${NC}"

# Check if minikube is installed
if ! command -v minikube &> /dev/null; then
    echo -e "${YELLOW}Installing minikube...${NC}"
    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    sudo install minikube-linux-amd64 /usr/local/bin/minikube
    rm minikube-linux-amd64
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}Installing kubectl...${NC}"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    sudo install kubectl /usr/local/bin/kubectl
    rm kubectl
fi

# Check for KVM support
if ! command -v virsh &> /dev/null; then
    echo -e "${YELLOW}KVM not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils
    sudo usermod -aG libvirt $USER
    sudo usermod -aG kvm $USER
    echo -e "${RED}Please log out and log back in for group changes to take effect, then run this script again.${NC}"
    exit 1
fi

# Check if minikube is already running
if minikube status &> /dev/null; then
    echo -e "${YELLOW}Minikube already running${NC}"
else
    echo -e "${GREEN}Starting minikube with KVM...${NC}"
    minikube start \
        --driver=kvm2 \
        --cpus=4 \
        --memory=8192 \
        --disk-size=50g
fi

# Enable addons
echo -e "${GREEN}Enabling addons...${NC}"
minikube addons enable ingress
minikube addons enable registry

# Set up binder for redroid
echo -e "${GREEN}Setting up binder for redroid...${NC}"
minikube ssh "sudo mkdir -p /dev/binderfs && sudo mount -t binder binder /dev/binderfs 2>/dev/null || true"

# Add gaming.local to /etc/hosts
MINIKUBE_IP=$(minikube ip)
if ! grep -q "gaming.local" /etc/hosts; then
    echo -e "${YELLOW}Adding gaming.local to /etc/hosts (requires sudo)...${NC}"
    echo "$MINIKUBE_IP gaming.local" | sudo tee -a /etc/hosts
else
    echo -e "${YELLOW}Updating gaming.local in /etc/hosts...${NC}"
    sudo sed -i "s/.*gaming.local/$MINIKUBE_IP gaming.local/" /etc/hosts
fi

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "Minikube IP: ${YELLOW}$MINIKUBE_IP${NC}"
echo -e "Gaming URL:  ${YELLOW}http://gaming.local${NC}"
echo ""
echo -e "Next steps:"
echo -e "  ${YELLOW}./scripts/dev-deploy.sh${NC}  - Build and deploy to local cluster"
echo -e "  ${YELLOW}minikube dashboard${NC}       - Open Kubernetes dashboard"
