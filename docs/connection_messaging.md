# Signal Server Messaging Flow

This document describes the complete message flow between Client, Signal Server, and Worker - from connection to gameplay.

## Visual Flow

```
┌────────────────┐          ┌────────────────┐          ┌────────────────┐
│     CLIENT     │          │  SIGNAL SERVER │          │     WORKER     │
└───────┬────────┘          └───────┬────────┘          └───────┬────────┘
        │                           │                           │
        │  ──── CONNECT (ws) ────►  │                           │
        │  ◄─── AUTHENTICATED ────  │                           │
        │                           │                           │
        │  ──────── QUEUE ───────►  │                           │
        │         {appId}           │                           │
        │                           │                           │
        │  ◄───── QUEUE_INFO ─────  │   (searches for worker)   │
        │       {position: 1}       │                           │
        │                           │                           │
        │           ...             │   (worker found!)         │
        │                           │                           │
        │  ◄───── QUEUE_READY ────  │                           │
        │                           │                           │
        │  (navigates to /app)      │                           │
        │                           │                           │
        │  ──────── START ───────►  │                           │
        │                           │  ─────── START ────────►  │
        │                           │  ── CLIENT_GAME_SELECTED ►│
        │                           │       {gameId}            │
        │                           │                           │
        │                           │  ◄──────── OFFER ───────  │
        │  ◄──────── OFFER ───────  │         {sdp}             │
        │          {sdp}            │                           │
        │                           │                           │
        │  ──────── ANSWER ──────►  │                           │
        │          {sdp}            │  ─────── ANSWER ───────►  │
        │                           │         {sdp}             │
        │                           │                           │
        │  ◄──── ICE_CANDIDATE ───  │  ◄──── ICE_CANDIDATE ───  │
        │  ──── ICE_CANDIDATE ───►  │  ──── ICE_CANDIDATE ───►  │
        │      (exchanged via       │      (multiple times)     │
        │       signal server)      │                           │
        │                           │                           │
        ├───────────────────────────┼───────────────────────────┤
        │                    WebRTC P2P ESTABLISHED             │
        ├───────────────────────────┼───────────────────────────┤
        │                           │                           │
        │  ◄═══════ VIDEO STREAM (RTP) ═══════════════════════  │
        │                           │                           │
        │  ═══════ INPUT (DataChannel) ═══════════════════════► │
        │      {DRAG, CLICK}        │                           │
        │                           │                           │
        │  ── CLIENT_INPUTED ────►  │   (keeps session alive)   │
        │                           │                           │
        ▼                           ▼                           ▼
```

## Phase Details

### 1. Authentication

Client connects to signal server with Supabase JWT token. Server validates token and checks subscription status.

```
Client                          Signal
  │                               │
  │── ws://signal?role=client ──► │
  │   &token=<jwt>                │
  │                               │ (verify token)
  │                               │ (check subscription)
  │◄────── AUTHENTICATED ──────── │
```

### 2. Queue

Client requests to play a game. Signal adds them to queue and sends position updates.

```
Client                          Signal
  │                               │
  │──── QUEUE {appId} ─────────► │
  │                               │ (add to queue)
  │◄──── QUEUE_INFO {pos:1} ──── │
  │                               │
  │           ...                 │ (interval function runs every 5s)
  │                               │ (finds available worker)
  │◄────── QUEUE_READY ────────── │
```

### 3. Start Connection

Client navigates to game page and sends START. Signal tells worker to begin.

```
Client                          Signal                         Worker
  │                               │                               │
  │ (navigates to /app/{appId})   │                               │
  │                               │                               │
  │──────── START ──────────────► │                               │
  │                               │─────── START ───────────────► │
  │                               │── CLIENT_GAME_SELECTED ─────► │
  │                               │      {gameId}                 │
```

### 4. WebRTC Signaling

Worker creates offer, client responds with answer. ICE candidates exchanged for NAT traversal.

```
Client                          Signal                         Worker
  │                               │                               │
  │                               │◄──────── OFFER {sdp} ──────── │
  │◄──────── OFFER {sdp} ──────── │                               │
  │                               │                               │
  │──────── ANSWER {sdp} ───────► │                               │
  │                               │─────── ANSWER {sdp} ────────► │
  │                               │                               │
  │◄───── ICE_CANDIDATE ───────── │◄────── ICE_CANDIDATE ──────── │
  │────── ICE_CANDIDATE ────────► │─────── ICE_CANDIDATE ───────► │
  │         (repeat)              │          (repeat)             │
```

#### How ICE Candidates Work

Two separate operations handle ICE:

| Function | What It Does |
|----------|--------------|
| `pc.onicecandidate` | Fires when WebRTC discovers YOUR network address. Send it to the other peer. |
| `pc.addIceCandidate()` | Called when you receive the OTHER peer's address. Add it so WebRTC can try it. |

**When does `onicecandidate` fire?**

After calling `setLocalDescription()`, WebRTC starts discovering network paths in the background:

```
setLocalDescription(offer)
       │
       ▼
   WebRTC discovers: "I'm reachable at 192.168.1.50:12345"
       │
       ▼
   FIRES: onicecandidate({ candidate: "192.168.1.50:12345" })  ──► Send to peer
       │
       ▼
   WebRTC asks STUN: "What's my public IP?"
       │
       ▼
   FIRES: onicecandidate({ candidate: "203.0.113.5:54321" })   ──► Send to peer
       │
       ▼
   FIRES: onicecandidate({ candidate: null })  // Done gathering
```

**The signal server just forwards - WebRTC does the testing:**

```
┌─────────────────────────────────────────────────────────────────┐
│  SIGNAL SERVER: Dumb relay. Forwards JSON. No checking.        │
│  WEBRTC ENGINE: Receives candidates, tests them, picks best.   │
└─────────────────────────────────────────────────────────────────┘
```

When both sides have added enough candidates, WebRTC internally tests which pairs work and establishes the P2P connection.

### 5. Data Flow (Post-WebRTC)

Once WebRTC is established, video and input flow directly between client and worker (P2P).

```
┌──────────┐                              ┌──────────┐
│  CLIENT  │ ════ WebRTC P2P (UDP) ═════► │  WORKER  │
│          │ ◄════════════════════════════ │          │
└──────────┘                              └──────────┘
     │                                          │
     │  Video: H264 stream via RTP              │
     │  Input: DRAG/CLICK via DataChannel       │
     │                                          │
     │  ──── CLIENT_INPUTED ────►  Signal       │
     │       (heartbeat only)                   │
```

## Heartbeat & Timeouts

Signal server maintains connection health via ping/pong and monitors for timeouts.

| Timeout | Threshold | Trigger |
|---------|-----------|---------|
| Ping timeout | 10s | No PONG response |
| Input timeout | 180s | No CLIENT_INPUTED (AFK) |
| Queue timeout | 20min | Waiting too long in queue |
| Connecting timeout | 30s | Got QUEUE_READY but no START |


