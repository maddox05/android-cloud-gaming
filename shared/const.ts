import type { Game } from "./types.js";

// Game Saves - Redroid base image version
// Increment this when creating a new base redroid image
// This ensures save compatibility (saves from v1 won't load on v2 base)
export const REDROID_BASE_IMAGE_VERSION = 2;

// R2 paths for game saves
export const R2_GAME_SAVES_PREFIX = "game_saves";

export const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const MAX_SESSION_TIME_MS = 60 * 60 * 1000; // 1 hour todo for laer use this in client & signal server
export const FREE_USER_MAX_TIME_MS = 10 * 60 * 1000; // 10 minutes for free users

export const REDROID_SCRCPY_SERVER_SETTINGS = {
  tunnelPort: 6767,
  // Video settings
  maxFps: 20, // max_fps
  videoBitRate: 100000, // video_bit_rate

  // Video codec options (H.264 profile settings)
  videoCodecOptions: {
    profile: 1, // Baseline profile for better compatibility
    level: 256, // Level 1.0
    iFrameInterval: 2, // I-frame every 2 seconds (doesnt follow this)
  },

  // Scrcpy server flags
  // sendDeviceMeta: false, // send_device_meta - don't send device name
  // sendCodecMeta: false, // send_codec_meta - don't send codec info
  // sendFrameMeta: false, // send_frame_meta - send PTS timestamps
  tunnelForward: false, // tunnel_forward - use adb forward instead of reverse
  audio: false, // audio - no audio streaming
  control: true, // control - enable touch/input control
  cleanup: false, // cleanup - don't restore display settings on exit
  rawStream: true, // raw_stream - use framed stream (not raw H.264)
  video: true, // video - enable video streaming
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
  {
    id: "com.roblox.client",
    name: "Roblox",
    description: "Make Anything, Enjoy Anything",
    thumbnail:
      "https://yt3.googleusercontent.com/xTxr7gmbkxiPKjrmN5ut0Kn8UcHpkkgyTv-_EeDPphcQusrWyKfSZw13EKCYXQyYdeoC3ON1zQ=s900-c-k-c0x00ffffff-no-rj",
  },
  {
    id: "com.tocaboca.tocalifeworld",
    name: "Toca Boca World",
    description: "Build your own world and stories",
    thumbnail:
      "https://play-lh.googleusercontent.com/AL4EeC-ElUtlJN2wZnQrDyC_8UpFYtvpK7AbJNJIQe0vYe8tucm6Qi20JJQlhCLHqw",
  },
  {
    id: "com.innersloth.spacemafia",
    name: "Among Us",
    description: "Find the impostor among your crew",
    thumbnail:
      "https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYj8fT9cfhfh3G0hnSruLKec",
  },
];
