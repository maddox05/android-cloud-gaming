import { execSync } from "child_process";

function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  return parts.every(part => part >= 0 && part <= 255);
}

function getRedroidHost(): string {
  // With network_mode: host, we need to find the container's IP via Docker
  const podName = process.env.POD_NAME;
  if (podName) {
    try {
      const containerName = `${podName}-redroid-1`;
      const networkName = `${podName}_internal`;
      const ip = execSync(
        `docker inspect -f '{{(index .NetworkSettings.Networks "${networkName}").IPAddress}}' ${containerName}`,
        { encoding: "utf-8" }
      ).trim();
      if (ip && isValidIP(ip)) {
        console.log(`Resolved redroid container IP: ${ip}`);
        return ip;
      }
      console.error(`Invalid IP returned from docker inspect: "${ip}"`);
      process.exit(1);
    } catch (e) {
      console.error("Failed to get redroid container IP");
      process.exit(1);
    }
  }

  console.error("POD_NAME environment variable not set, cannot resolve redroid container IP");
  process.exit(1);
}

export const redroid_config = {
  host: getRedroidHost(),
  port: 5555,
};

export const scrcpy_config = {
  // Single port - scrcpy uses one abstract socket, we connect multiple times
  // First connection = video, second connection = control
  port: 6767,
};
