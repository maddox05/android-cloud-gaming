#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}=== Building and Deploying to Local Kubernetes ===${NC}"

# Check minikube is running
if ! minikube status &> /dev/null; then
    echo -e "${RED}Minikube not running. Run ./scripts/dev-setup.sh first${NC}"
    exit 1
fi

# Use minikube's Docker daemon
echo -e "${GREEN}[1/4] Connecting to minikube Docker...${NC}"
eval $(minikube docker-env)

# Build images
echo -e "${GREEN}[2/4] Building Docker images...${NC}"
docker build -t localhost:5000/signal:dev "$PROJECT_DIR/signal"
docker build -t localhost:5000/worker:dev "$PROJECT_DIR/worker"

# Push to minikube registry
echo -e "${GREEN}[3/4] Pushing to local registry...${NC}"
docker push localhost:5000/signal:dev
docker push localhost:5000/worker:dev

# Deploy with kustomize
echo -e "${GREEN}[4/4] Deploying to Kubernetes...${NC}"
kubectl apply -k "$PROJECT_DIR/k8s/overlays/dev"

# Wait for deployment
echo -e "${YELLOW}Waiting for signal-server to be ready...${NC}"
kubectl rollout status deployment/signal-server -n gaming --timeout=120s

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "Signal server: ${YELLOW}http://gaming.local${NC}"
echo -e "              ${YELLOW}ws://gaming.local${NC}"
echo ""
echo -e "Useful commands:"
echo -e "  ${YELLOW}kubectl get pods -n gaming${NC}         - List pods"
echo -e "  ${YELLOW}kubectl logs -n gaming -l app=signal-server -f${NC}  - View logs"
echo -e "  ${YELLOW}minikube dashboard${NC}                 - Open dashboard"
