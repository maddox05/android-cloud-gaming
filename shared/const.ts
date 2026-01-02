export const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const MAX_SESSION_TIME_MS = 60 * 1000; // 1 hour todo for laer use this in client & signal server

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
