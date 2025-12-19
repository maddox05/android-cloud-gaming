#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Tearing down local Kubernetes ===${NC}"

read -p "This will delete all local K8s resources. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Delete gaming namespace (removes all resources)
kubectl delete namespace gaming --ignore-not-found=true

# Optionally stop minikube
read -p "Also stop minikube? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    minikube stop
fi

echo -e "${GREEN}Done${NC}"
