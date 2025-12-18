# scrcpy Protocol Guide

Notes on how scrcpy works for streaming video and injecting input, learned while building this project.

## Key Insight: Single Socket, Multiple Connections

**This tripped me up initially.** scrcpy doesn't use separate ports for video and control. Instead:

- Server listens on ONE abstract socket: `localabstract:scrcpy`
- Clients connect multiple times to the same socket
- Connections are served **in order**: video first, then audio (if enabled), then control

```bash
# ONE forward, not multiple
adb forward tcp:6767 localabstract:scrcpy

# Then connect to localhost:6767 TWICE:
# 1st connection → video socket
# 2nd connection → control socket (when audio=false)
```

If you connect in the wrong order or create separate forwards, it won't work.

## Starting the Server

```bash
adb shell CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar \
    app_process / com.genymobile.scrcpy.Server 2.1 \
    tunnel_forward=true \
    audio=false \
    control=true \
    cleanup=false \
    raw_stream=true \
    max_size=360
```

### Important Options

| Option | Description |
|--------|-------------|
| `tunnel_forward=true` | Device listens, we connect (vs reverse where we listen) |
| `audio=false` | Disables audio socket (so control becomes 2nd connection) |
| `control=true` | Enables control socket for input injection |
| `raw_stream=true` | **Critical**: Disables all metadata/headers on video |
| `max_size=360` | Max dimension of video output |

### What `raw_stream=true` Disables

Without this flag, scrcpy sends metadata you'd need to parse:
- Device name on first socket
- Dummy byte for connection detection
- Codec metadata (codec ID, width, height)
- 12-byte frame headers (flags, PTS, packet size)

With `raw_stream=true`, you get pure H.264 NAL units directly. Much simpler.

## Video Stream

With `raw_stream=true`, the video socket outputs raw H.264:

```
[NAL unit][NAL unit][NAL unit]...
```

NAL units start with `0x00 0x00 0x00 0x01` or `0x00 0x00 0x01`.

### NAL Unit Types (relevant ones)

| Type | Name | Description |
|------|------|-------------|
| 5 | IDR | Keyframe (can decode independently) |
| 7 | SPS | Sequence Parameter Set (codec config) |
| 8 | PPS | Picture Parameter Set (codec config) |
| 1 | Non-IDR | Delta frame (needs previous frames) |

For WebCodecs VideoDecoder, you need SPS/PPS before decoding. scrcpy sends these at the start and on resolution changes.

## Control Protocol (Input Injection)

Control messages are binary, big-endian. The first byte is the message type.

### Message Types

| Value | Type |
|-------|------|
| 0 | Inject keycode |
| 1 | Inject text |
| 2 | **Inject touch event** |
| 3 | Inject scroll event |
| 4 | Back or screen on |
| 5 | Expand notification panel |
| ... | (many more) |

### Touch Event Format (32 bytes)

This is the one you'll use most:

```
Byte   Size   Type     Field
────────────────────────────────────────
0      1      u8       message type (= 2)
1      1      u8       action
2      8      i64 BE   pointer ID
10     4      i32 BE   x coordinate
14     4      i32 BE   y coordinate
18     2      u16 BE   screen width
20     2      u16 BE   screen height
22     2      u16 BE   pressure (0-0xFFFF)
24     4      i32 BE   action button
28     4      i32 BE   buttons state
────────────────────────────────────────
Total: 32 bytes
```

### Action Values (Android MotionEvent)

| Value | Action |
|-------|--------|
| 0 | ACTION_DOWN |
| 1 | ACTION_UP |
| 2 | ACTION_MOVE |

### Button Values

| Value | Button |
|-------|--------|
| 1 | BUTTON_PRIMARY (left click / touch) |
| 2 | BUTTON_SECONDARY (right click) |
| 4 | BUTTON_TERTIARY (middle click) |

### Pressure

Fixed-point value from 0 to 0xFFFF:
- `0x0000` = no pressure (use for ACTION_UP)
- `0xFFFF` = full pressure
- `0x8000` = half pressure

### Screen Width/Height Caveat

**Important**: These must match the current video frame dimensions. If you send coordinates with wrong dimensions (e.g., after rotation), scrcpy may ignore the input.

## Caveats & Gotchas

### 1. Connection Order Matters
Video socket MUST connect before control socket. No exceptions.

### 2. Version Matching
The first argument to Server (`2.1`) must match the scrcpy-server jar version exactly. Mismatches cause silent failures.

### 3. Coordinates Are Absolute
Touch coordinates are in screen pixels, not normalized 0-1. Must match screen dimensions.

### 4. No Audio = Control is 2nd
With `audio=false`:
- 1st connection = video
- 2nd connection = control

With `audio=true`:
- 1st = video
- 2nd = audio
- 3rd = control

### 5. Device Messages (Control Socket is Bidirectional)
The control socket can also RECEIVE data from the device (clipboard changes, ACKs). For MVP you can ignore these, but the socket will have incoming data.

### 6. Raw Stream Has No Framing
With `raw_stream=true`, there are no packet boundaries. TCP may deliver partial NAL units. You need to buffer and parse NAL start codes yourself.

## Example: Sending a Tap

```typescript
function sendTap(x: number, y: number, screenWidth: number, screenHeight: number) {
  const down = Buffer.alloc(32);
  down.writeUInt8(2, 0);           // message type
  down.writeUInt8(0, 1);           // ACTION_DOWN
  down.writeBigInt64BE(0n, 2);     // pointer ID
  down.writeInt32BE(x, 10);        // x
  down.writeInt32BE(y, 14);        // y
  down.writeUInt16BE(screenWidth, 18);
  down.writeUInt16BE(screenHeight, 20);
  down.writeUInt16BE(0xFFFF, 22);  // full pressure
  down.writeInt32BE(1, 24);        // action button = primary
  down.writeInt32BE(1, 28);        // buttons = primary held

  const up = Buffer.alloc(32);
  up.writeUInt8(2, 0);
  up.writeUInt8(1, 1);             // ACTION_UP
  up.writeBigInt64BE(0n, 2);
  up.writeInt32BE(x, 10);
  up.writeInt32BE(y, 14);
  up.writeUInt16BE(screenWidth, 18);
  up.writeUInt16BE(screenHeight, 20);
  up.writeUInt16BE(0, 22);         // no pressure
  up.writeInt32BE(0, 24);          // no action button
  up.writeInt32BE(0, 28);          // no buttons held

  socket.write(down);
  socket.write(up);
}
```

## References

- [scrcpy developer docs](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md) - Official protocol overview
- [ControlMessageReader.java](https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/control/ControlMessageReader.java) - Server-side parsing (shows exact format)
- [test_control_msg_serialize.c](https://github.com/Genymobile/scrcpy/blob/master/app/tests/test_control_msg_serialize.c) - Client-side tests (shows byte layout)
- [Tango ADB scrcpy docs](https://tangoadb.dev/scrcpy/control/touch/) - Good TypeScript/JS focused docs
- [Options.java](https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/Options.java) - All server options
