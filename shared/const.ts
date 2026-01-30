import type { Game } from "./types.js";

// Game Saves - Redroid base image version
// Increment this when creating a new base redroid image
// This ensures save compatibility (saves from v1 won't load on v2 base)
export const REDROID_BASE_IMAGE_VERSION = 3;

export const ENABLE_GAME_SAVES = true;

// R2 paths for game saves
export const R2_GAME_SAVES_PREFIX = "game_saves";

export const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export const MAX_SESSION_TIME_MS = 60 * 60 * 1000; // 1 hour todo for laer use this in client & signal server
export const FREE_USER_MAX_TIME_MS = 10 * 60 * 1000; // 10 minutes for free users

export const REDROID_SCRCPY_SERVER_SETTINGS = {
  // Video settings
  maxFps: 60, // max_fps
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
    slug: "clash-royale",
    name: "Clash Royale",
    category: "Strategy",
    description: `Play Clash Royale instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Clash Royale is a real-time multiplayer game starring the Royales, your favorite Clash characters and much, much more. Collect and upgrade dozens of cards featuring the Clash of Clans troops, spells and defenses you know and love.

**Features:**
- Real-time PvP battles
- Collect and upgrade cards
- Build your ultimate Battle Deck
- Progress through Arenas`,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMt18VVv2_bw1FRALdGOsPqf027hhFfQVFzQ&s",
    images: [],
    onPhone: true,
  },
  {
    id: "com.supercell.clashofclans",
    slug: "clash-of-clans",
    name: "Clash of Clans",
    category: "Strategy",
    description: `Play Clash of Clans instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Clash of Clans is an epic combat strategy game. Build your village, train your troops, and battle with millions of other players online! Forge a powerful Clan with other players and crush enemy clans in Clan Wars.

**Features:**
- Build your village into an unbeatable fortress
- Raise your own army of Barbarians, Archers, and more
- Battle with players worldwide
- Join a Clan and take part in Clan Wars`,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR25TlNh8ve7ot5SIbP9nwgGNygwmb6g2dxFQ&s",
    images: [],
    onPhone: true,
  },
  {
    id: "youtube.lite.anikinc",
    slug: "youtube-lite",
    name: "YouTube Lite",
    category: "Entertainment",
    description: `Play YouTube Lite instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality streaming experience.

YouTube Lite is a lightweight version of YouTube optimized for faster loading and less data usage. Watch your favorite videos, subscribe to channels, and enjoy content without the bloat.

**Features:**
- Lightweight and fast
- Lower data usage
- All your favorite content
- Simple and clean interface`,
    thumbnail:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/YouTube_social_white_square_%282024%29.svg/1200px-YouTube_social_white_square_%282024%29.svg.png",
    images: [],
    onPhone: true,
  },
  {
    id: "com.roblox.client",
    slug: "roblox",
    name: "Roblox",
    category: "Adventure",
    description: `Play Roblox instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Roblox is the ultimate virtual universe that lets you create, share experiences with friends, and be anything you can imagine. Join millions of people and discover an infinite variety of immersive experiences created by a global community.

**Features:**
- Millions of experiences to explore
- Play with friends across devices
- Create your own games
- Customize your avatar`,
    thumbnail:
      "https://yt3.googleusercontent.com/xTxr7gmbkxiPKjrmN5ut0Kn8UcHpkkgyTv-_EeDPphcQusrWyKfSZw13EKCYXQyYdeoC3ON1zQ=s900-c-k-c0x00ffffff-no-rj",
    images: [
      "https://media.wired.com/photos/611e8c4c616d2959940414e8/16:9/w_2400,h_1350,c_limit/Games-Roblox-Exploitation.jpg",
      "https://media.wired.com/photos/611e8c4c616d2959940414e8/16:9/w_2400,h_1350,c_limit/Games-Roblox-Exploitation.jpg",
      "https://media.wired.com/photos/611e8c4c616d2959940414e8/16:9/w_2400,h_1350,c_limit/Games-Roblox-Exploitation.jpg",
    ],
    onPhone: true,
    quickAlert:
      "There is currently an issue where you get booted out after 5 minutes. You can browse avatars and games but not much else. We are working on a fix.",
  },
  {
    id: "com.tocaboca.tocalifeworld",
    slug: "toca-boca-world",
    name: "Toca Boca World",
    category: "Simulation",
    description: `Play Toca Boca World instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Toca Boca World is the app where you can create your own world and play out any story you like. This mega-app lets you explore tons of locations, meet fun characters, and play with pets and so much more!

**Features:**
- Create your own stories
- Explore tons of locations
- Collect characters and pets
- Endless creative possibilities`,
    thumbnail:
      "https://play-lh.googleusercontent.com/AL4EeC-ElUtlJN2wZnQrDyC_8UpFYtvpK7AbJNJIQe0vYe8tucm6Qi20JJQlhCLHqw",
    images: [],
    onPhone: true,
  },
  {
    id: "com.innersloth.spacemafia",
    slug: "among-us",
    name: "Among Us",
    category: "Party",
    description: `Play Among Us instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Among Us is an online multiplayer social deduction game where Crewmates work together to complete tasks while trying to identify the Impostors among them. Play with 4-15 players online or via local WiFi.

**Features:**
- Play with 4-15 players
- Cross-platform play
- Customizable settings
- Multiple maps to explore`,
    thumbnail:
      "https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYj8fT9cfhfh3G0hnSruLKec",
    images: [],
    onPhone: true,
  },
  {
    id: "com.robtopx.geometryjumplite",
    slug: "geometry-dash-lite",
    name: "Geometry Dash Lite",
    category: "Arcade",
    description: `Play Geometry Dash Lite instantly in your browser without downloading. Enjoy lag-free, low latency, and high-quality gaming experience playing this game.

Geometry Dash Lite is a rhythm-based action platformer where you jump and fly your way through danger. Push your skills to the limit as you jump, fly and flip through dangerous passages and spiky obstacles.

**Features:**
- Rhythm-based action platformer
- Multiple levels with unique soundtracks
- Practice mode to hone your skills
- Unlock new icons and colors`,
    thumbnail:
      "https://play-lh.googleusercontent.com/p7kWbWBFxQIrzolEqiV5uSvctLeyssZvBV7UBOX29wzZI52IdcSs4qCB_zsQJL1mt9A",
    images: [],
    onPhone: false,
    relativeLink: "g/geometry-dash-lite/index.html",
  },
];

/** Find a game by its slug */
export function getGameBySlug(slug: string): Game | undefined {
  return GAMES_LIST.find((game) => game.slug === slug);
}

/** Find a game by its package ID */
export function getGameById(id: string): Game | undefined {
  return GAMES_LIST.find((game) => game.id === id);
}
