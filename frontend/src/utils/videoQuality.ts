export type VideoQuality = "HD" | "LD" | "ULD";

const VIDEO_QUALITY_KEY = "videoQuality";

const QUALITY_MAP: Record<VideoQuality, number> = {
  HD: 1920,
  LD: 1080,
  ULD: 640,
};

export function getVideoQuality(): VideoQuality {
  const stored = localStorage.getItem(VIDEO_QUALITY_KEY);
  if (stored && (stored === "HD" || stored === "LD" || stored === "ULD")) {
    return stored;
  }
  return "ULD"; // Default
}

export function setVideoQuality(quality: VideoQuality): void {
  localStorage.setItem(VIDEO_QUALITY_KEY, quality);
}

export function getMaxVideoSize(): number {
  return QUALITY_MAP[getVideoQuality()];
}
