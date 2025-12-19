#!/bin/bash
# View signal server logs
kubectl logs -n gaming -l app=signal-server -f --all-containers=true
