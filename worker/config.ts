import { execSync } from "child_process";

function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  return parts.every(part => part >= 0 && part <= 255);
}

function tryGetContainerIP(cmd: string, containerName: string, networkName: string): string | null {
  try {
    // Get full JSON and parse it instead of using Go templates
    const json = execSync(
      `${cmd} inspect ${containerName} 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();

    const data = JSON.parse(json);
    const networks = data[0]?.NetworkSettings?.Networks;

    if (!networks) {
      return null;
    }

    // Try specific network first
    if (networks[networkName]?.IPAddress && isValidIP(networks[networkName].IPAddress)) {
      return networks[networkName].IPAddress;
    }

    // Fallback: get first available network IP
    for (const net of Object.values(networks) as { IPAddress?: string }[]) {
      if (net.IPAddress && isValidIP(net.IPAddress)) {
        return net.IPAddress;
      }
    }
  } catch {
    // Command failed or JSON parse failed
  }
  return null;
}

function getRedroidHost(): string {
  // With network_mode: host, we need to find the container's IP via Docker/Podman
  const podName = process.env.POD_NAME;
  if (!podName) {
    console.error("POD_NAME environment variable not set, cannot resolve redroid container IP");
    process.exit(1);
  }

  // Try different container naming conventions (docker-compose uses dash, podman-compose may use underscore)
  const containerNames = [`${podName}-redroid-1`, `${podName}_redroid_1`];
  const networkName = `${podName}_internal`;
  const commands = ["podman", "docker"]; // Try podman first on Fedora

  for (const cmd of commands) {
    for (const containerName of containerNames) {
      const ip = tryGetContainerIP(cmd, containerName, networkName);
      if (ip) {
        console.log(`Resolved redroid container IP: ${ip} (via ${cmd})`);
        return ip;
      }
    }
  }

  console.error(`Failed to resolve redroid container IP. Tried containers: ${containerNames.join(", ")} with podman and docker`);
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
