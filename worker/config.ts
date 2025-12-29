import { execSync } from "child_process";

function getRedroidHost(): string {
  // If explicitly set, use that
  if (process.env.REDROID_HOST) {
    return process.env.REDROID_HOST;
  }

  // With network_mode: host, we need to find the container's IP via Docker
  const podName = process.env.POD_NAME;
  if (podName) {
    try {
      const containerName = `${podName}-redroid-1`;
      const ip = execSync(
        `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`,
        { encoding: "utf-8" }
      ).trim();
      if (ip) {
        console.log(`Resolved redroid container IP: ${ip}`);
        return ip;
      }
    } catch (e) {
      console.warn("Failed to get redroid container IP, falling back to localhost");
    }
  }

  return "localhost";
}

export const redroid_config = {
  host: getRedroidHost(),
  port: 5555,
  width: parseInt(process.env.REDROID_WIDTH || "360"),
  height: parseInt(process.env.REDROID_HEIGHT || "640"),
  video_bit_rate: process.env.REDROID_VIDEO_BIT_RATE || "2M",
  max_fps: parseInt(process.env.REDROID_FPS || "60"),
};

export const scrcpy_config = {
  // Single port - scrcpy uses one abstract socket, we connect multiple times
  // First connection = video, second connection = control
  port: 6767,
};

