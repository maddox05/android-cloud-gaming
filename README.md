# MaddoxCloud - Android Cloud Gaming

A cloud gaming platform that streams Android games to your browser using WebRTC. Play mobile games on any device with a web browser.

## Features

- Stream Android games directly to your browser
- Low-latency WebRTC video streaming
- Touch and keyboard input support
- User authentication via Supabase (Google, Microsoft, Email)
- Subscription management with Stripe
- Queue system for managing game sessions
- Waitlist and invite code system

## Architecture

The project consists of three main components:

- **Frontend** (`/frontend`) - React + TypeScript web application built with Vite
- **Signal Server** (`/signal`) - WebSocket signaling server for WebRTC coordination and API endpoints
- **Worker** (`/worker`) - Manages Redroid (Android in Docker) containers and handles video streaming

## Prerequisites

- Node.js 18+
- Docker with privileged container support
- A Linux host with kernel modules for Redroid (binder, ashmem)
- Supabase project (for authentication and database)
- Cloudflare account (for TURN server credentials)
- Stripe account (for payments, optional)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/android-cloud-gaming.git
cd android-cloud-gaming
```

### 2. Configure environment variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values. See [Environment Variables](#environment-variables) for details.

### 3. Install dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..

# Signal server dependencies
cd signal && npm install && cd ..

# Worker dependencies
cd worker && npm install && cd ..
```

### 4. Create the Redroid base volume

```bash
docker volume create redroid-base
```

See `docs/HOW_TO_CREATE_GOLDEN_REDROID_IMAGE.md` for creating a pre-configured Android image.

## Running the Application

### Start the Signal Server

```bash
docker compose -f docker-compose.signal.yml up --build
```

### Start a Worker

```bash
docker compose -p worker0 -f docker-compose.worker.yml up --build
```

### Start the Frontend (Development)

```bash
cd frontend
npm run dev
```

## Environment Variables

| Variable                          | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `SIGNAL_PORT`                     | Port for the signal server (default: 8080)   |
| `SIGNAL_URL`                      | URL of the signal server                     |
| `REDROID_IMAGE`                   | Docker image for Redroid                     |
| `REDROID_TAG`                     | Tag for the Redroid image                    |
| `SUPABASE_URL`                    | Your Supabase project URL                    |
| `SUPABASE_SERVICE_KEY`            | Supabase service role key (server-side only) |
| `CLOUDFLARE_TURN_KEY_ID`          | Cloudflare TURN key ID                       |
| `CLOUDFLARE_TURN_API_TOKEN`       | Cloudflare TURN API token                    |
| `CLOUDFLARE_R2_TOKEN`             | Cloudflare R2 token (for image storage)      |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 access key ID                             |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret access key                         |

## Project Structure

```
android-cloud-gaming/
├── frontend/          # React web application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context providers
│   │   ├── home/         # Home page components
│   │   ├── in_game/      # Game streaming interface
│   │   ├── launch/       # Waitlist and onboarding
│   │   ├── pages/        # Static pages (About, TOS, etc.)
│   │   ├── pricing/      # Subscription pricing
│   │   ├── queue/        # Queue management
│   │   └── utils/        # Utility functions
│   └── public/           # Static assets
├── signal/            # WebSocket signaling server
│   └── db/               # Database utilities
├── worker/            # Redroid container manager
├── shared/            # Shared types and utilities
├── docs/              # Documentation
└── docker-compose.*.yml  # Docker configurations
```

## Documentation

- [Connection Messaging Protocol](docs/connection_messaging.md)
- [Creating a Golden Redroid Image](docs/HOW_TO_CREATE_GOLDEN_REDROID_IMAGE.md)
- [Scrcpy Protocol Reference](docs/SCRCPY_PROTOCOL.md)
- [Optimization TODOs](docs/TODO_OPTIMIZATIONS.md)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

See the [LICENSE](LICENSE) file for details.

**Attribution Required:** If you use this code, you must link this project.

## Acknowledgments

- [Redroid](https://github.com/remote-android/redroid-doc) - Android in Docker
- [Scrcpy](https://github.com/Genymobile/scrcpy) - Screen mirroring protocol reference
- [Supabase](https://supabase.com) - Backend as a Service
- [Cloudflare](https://cloudflare.com) - TURN servers and R2 storage
