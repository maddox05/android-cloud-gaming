# Android Cloud Gaming Platform - Architecture

A WebRTC-based cloud gaming platform that streams Android (Redroid) to browsers with touch input support.

## Overview

```
┌─────────────┐         WebSocket          ┌─────────────────┐
│   Browser   │◄─────────signaling────────►│  Signal Server  │
│  (Frontend) │                            │   (port 8080)   │
└──────┬──────┘                            └────────┬────────┘
       │                                            │
       │  WebRTC DataChannels                       │ WebSocket
       │  (video: H.264, input: JSON)               │ (signaling relay)
       │                                            │
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                         Pod (Node.js)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ VideoHandler│  │ InputHandler │  │   RedroidRunner     │  │
│  │  (H.264)    │  │  (scrcpy)    │  │ (Docker + scrcpy)   │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────┬───────┘                     │             │
│                  │ TCP (port 6767)             │             │
│                  ▼                             │             │
│         ┌────────────────┐                     │             │
│         │ scrcpy-server  │◄────────────────────┘             │
│         │  (on device)   │        ADB                        │
│         └────────┬───────┘                                   │
│                  │                                           │
│                  ▼                                           │
│         ┌────────────────┐                                   │
│         │    Redroid     │                                   │
│         │   (Android)    │                                   │
│         │  Docker :5555  │                                   │
│         └────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1. Signal Server (`signal/`)

WebSocket server that facilitates WebRTC signaling between browser and pod.

**Flow:**
1. Pod connects with `?role=pod`
2. Browser connects (no role = client)
3. Browser sends `{ type: "start" }`
4. Signal server relays messages until WebRTC connection established
5. After WebRTC connects, signal server is no longer needed for data transfer

**Messages:**
| From | Type | Description |
|------|------|-------------|
| Client | `start` | Request to begin session |
| Pod | `offer` | WebRTC SDP offer |
| Client | `answer` | WebRTC SDP answer |
| Both | `ice-candidate` | ICE candidates for NAT traversal |

### 2. Pod (`node/pod/`)

The worker node that runs Android and streams to browsers.

#### RedroidRunner (`redriod_runner.ts`)
Singleton that manages the Android container lifecycle:
- Starts Redroid Docker container
- Waits for Android boot
- Pushes and starts scrcpy-server
- Sets up ADB port forwarding

#### VideoHandler (`video.ts`)
Singleton that receives raw H.264 video from scrcpy:
- Connects to scrcpy video socket (MUST connect first)
- Receives raw H.264 stream (no headers with `raw_stream=true`)
- Pipes data to WebRTC DataChannel

#### InputHandler (`input.ts`)
Singleton that sends touch events to scrcpy:
- Connects to scrcpy control socket (MUST connect second)
- Translates JavaScript touch events to scrcpy binary protocol
- Sends 32-byte touch injection messages

#### Main (`main.ts`)
Entry point that orchestrates everything:
- Starts RedroidRunner
- Connects video then input handlers (order matters!)
- Connects to signal server
- Manages WebRTC peer connection with @roamhq/wrtc
- Creates DataChannels for video (unreliable) and input (reliable)

### 3. Frontend (`frontend/`)

Simple HTML page that:
- Connects to signal server for WebRTC signaling
- Receives H.264 via DataChannel
- Decodes using WebCodecs VideoDecoder API
- Renders to canvas
- Captures pointer events and sends to input DataChannel

## scrcpy Protocol

### Connection

scrcpy uses a **single abstract socket** (`localabstract:scrcpy`) that serves multiple connections in order:

1. **Video socket** (first connection)
2. **Audio socket** (second connection, disabled in our case)
3. **Control socket** (third connection, second for us since audio=false)

```bash
# Single ADB forward
adb forward tcp:6767 localabstract:scrcpy

# Start scrcpy server
adb shell CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar \
    app_process / com.genymobile.scrcpy.Server 2.1 \
    tunnel_forward=true \
    audio=false \
    control=true \
    cleanup=false \
    raw_stream=true \
    max_size=360
```

With `raw_stream=true`, the video socket outputs pure H.264 without any framing or metadata.

### Touch Injection Protocol

Control messages use a binary protocol. Touch events are 32 bytes:

```
Offset  Size  Field           Description
──────────────────────────────────────────────────────
0       1     type            Message type (2 = inject touch)
1       1     action          MotionEvent action (0=down, 1=up, 2=move)
2       8     pointerId       64-bit pointer identifier (big-endian)
10      4     x               X coordinate (big-endian i32)
14      4     y               Y coordinate (big-endian i32)
18      2     screenWidth     Display width (big-endian u16)
20      2     screenHeight    Display height (big-endian u16)
22      2     pressure        Touch pressure 0-0xFFFF (big-endian u16)
24      4     actionButton    Button that triggered action (big-endian i32)
28      4     buttons         Currently pressed buttons (big-endian i32)
──────────────────────────────────────────────────────
Total: 32 bytes
```

## WebRTC Architecture

Uses `@roamhq/wrtc` for Node.js WebRTC support.

**DataChannels:**
- `video` - Unreliable, unordered (fast, okay to drop frames)
- `input` - Reliable, ordered (touch events must arrive)

**Why DataChannels instead of MediaStream?**
- Direct H.264 passthrough (no transcoding)
- Lower latency
- Browser decodes with WebCodecs VideoDecoder

## Running

```bash
# Terminal 1: Signal Server
cd signal
npm install
npm start

# Terminal 2: Pod (on server with Docker)
cd node/pod
npm install
npm start

# Terminal 3: Frontend
cd frontend
python3 -m http.server 3000
# Open http://localhost:3000
```

## Configuration

Edit `node/pod/config.ts`:

```typescript
export const redroid_config = {
  redroid_docker_container_name: "redroid-worker",
  redroid_docker_port: 5555,
  redroid_docker_image_name: "redroid/redroid",
  redroid_docker_image_tag: "12.0.0_64only-latest",
  redroid_width: 360,
  redroid_height: 640,
  redroid_dpi: 120,
  redroid_fps: 20,
};

export const scrcpy_config = {
  port: 6767,  // Single port, multiple connections
};
```

## Prerequisites

- Docker with Redroid image
- ADB (Android Debug Bridge)
- scrcpy-server-v2.1 jar in `node/pod/`
- Node.js 18+

## References

- [scrcpy for developers](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md) - Protocol documentation
- [scrcpy control protocol](https://tangoadb.dev/scrcpy/control/) - Control message format
- [Touch event format](https://tangoadb.dev/scrcpy/control/touch/) - Touch injection details
- [ControlMessageReader.java](https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/control/ControlMessageReader.java) - Server-side message parsing
- [test_control_msg_serialize.c](https://github.com/Genymobile/scrcpy/blob/master/app/tests/test_control_msg_serialize.c) - Client-side message serialization tests
- [Redroid](https://github.com/remote-android/redroid-doc) - Android in Docker
- [@roamhq/wrtc](https://github.com/ArslanKibria98/wrtc) - Node.js WebRTC implementation
