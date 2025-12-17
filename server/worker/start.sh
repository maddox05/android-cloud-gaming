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
    redroid/redroid:12.0.0-latest \
    androidboot.redroid_width=360 \
    androidboot.redroid_height=640 \
    androidboot.redroid_dpi=120 \
    androidboot.redroid_fps=20)

echo "$CONTAINER_ID"

# todo for future
# each worker needs to be containerized, so if i started another, they would be separate, i need to start multiple on one machine
