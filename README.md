# Android Cloud Gaming Platform

Stream Android games from the cloud to your browser with low-latency touch controls.

## Quick Start

```bash
# 1. Signal Server
cd signal && npm install && npm start

# 2. Pod (on server with Docker + ADB)
cd node/pod && npm install && npm start

# 3. Frontend
cd frontend && python3 -m http.server 3000
```

Open http://localhost:3000 and click Connect.

## Requirements

- Linux server with Docker
- [Redroid](https://github.com/remote-android/redroid-doc) Docker image
- ADB installed
- `scrcpy-server-v2.1` jar in `node/pod/`
- Node.js 18+

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

```
Browser <--WebRTC--> Pod <--scrcpy--> Redroid (Android in Docker)
            |
      Signal Server (WebSocket signaling)
```

## Features

- Raw H.264 streaming via WebRTC DataChannel
- Touch input support (tap, drag, swipe)
- WebCodecs VideoDecoder for low-latency playback
- Single client per pod (MVP)

## License

MIT
