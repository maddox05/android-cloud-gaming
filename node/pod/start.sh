#!/bin/bash
# Start Redroid container for Android cloud gaming
# Runs at 360p @ 20fps for performance
# Usage: ./start.sh <PORT> <CONTAINER_NAME>

PORT=${1:-5555}
CONTAINER_NAME=${2:-redroid-worker}

CONTAINER_ID=$(sudo docker run -itd --rm --privileged \
    --name "$CONTAINER_NAME" \
    -v ~/data:/data \
    -p "$PORT:5555" \
    rredroid/redroid:12.0.0_64only-latest \
    androidboot.redroid_width=360 \
    androidboot.redroid_height=640 \
    androidboot.redroid_dpi=120 \
    androidboot.redroid_fps=20)

echo "$CONTAINER_ID"

# del this file and use redroid runner instead.