import type { Game } from "./types.js";
export const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const MAX_SESSION_TIME_MS = 60 * 60 * 1000; // 1 hour todo for laer use this in client & signal server

export const REDROID_SCRCPY_SERVER_SETTINGS = {
  // Display settings
  width: 360,
  height: 640,
  dpi: 120,

  // Video settings
  maxSize: 640, // max_size - scales video to fit this dimension
  maxFps: 20, // max_fps
  videoBitRate: 100000, // video_bit_rate

  // Video codec options (H.264 profile settings)
  videoCodecOptions: {
    profile: 1, // Baseline profile for better compatibility
    level: 256, // Level 1.0
    iFrameInterval: 2, // I-frame every 2 seconds
  },

  // Scrcpy server flags
  // sendDeviceMeta: false, // send_device_meta - don't send device name
  // sendCodecMeta: false, // send_codec_meta - don't send codec info
  // sendFrameMeta: false, // send_frame_meta - send PTS timestamps
  tunnelForward: true, // tunnel_forward - use adb forward instead of reverse
  audio: false, // audio - no audio streaming
  control: true, // control - enable touch/input control
  cleanup: false, // cleanup - don't restore display settings on exit
  rawStream: true, // raw_stream - use framed stream (not raw H.264)
  video: true, // video - enable video streaming
  sendFrameMeta: true, // send_frame_meta - don't send PTS timestamps
};

export const GAMES_LIST: Game[] = [
  {
    id: "com.supercell.clashroyale",
    name: "Clash Royale",
    description: "Real-time PvP battles",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMt18VVv2_bw1FRALdGOsPqf027hhFfQVFzQ&s",
  },
  {
    id: "com.supercell.clashofclans",
    name: "Clash of Clans",
    description: "Strategic base building game",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR25TlNh8ve7ot5SIbP9nwgGNygwmb6g2dxFQ&s",
  },
  {
    id: "youtube.lite.anikinc",
    name: "YouTube Lite",
    description: "Lightweight YouTube experience",
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/YouTube_social_white_square_%282024%29.svg/1200px-YouTube_social_white_square_%282024%29.svg.png",
  },
];
