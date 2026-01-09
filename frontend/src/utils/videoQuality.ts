import type { VideoQuality } from "../../../shared/types";
import { MAX_VIDEO_SIZE_MAP } from "../../../shared/types";

export type { VideoQuality };
export { MAX_VIDEO_SIZE_MAP as VIDEO_SIZE_MAP };

const VIDEO_QUALITY_KEY = "videoQuality";

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
  return MAX_VIDEO_SIZE_MAP[getVideoQuality()];
}
