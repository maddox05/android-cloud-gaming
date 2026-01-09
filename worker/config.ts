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
    console.log(`Trying: ${cmd} inspect ${containerName}`);
    const json = execSync(
      `${cmd} inspect ${containerName} 2>&1`,
      { encoding: "utf-8" }
    ).trim();

    let data;
    try {
      data = JSON.parse(json);
    } catch {
      console.log(`  JSON parse failed, raw output: ${json.substring(0, 200)}`);
      return null;
    }

    const networks = data[0]?.NetworkSettings?.Networks;
    console.log(`  Networks found: ${networks ? Object.keys(networks).join(", ") : "none"}`);

    if (!networks) {
      return null;
    }

    // Try specific network first
    if (networks[networkName]?.IPAddress && isValidIP(networks[networkName].IPAddress)) {
      console.log(`  Found IP in ${networkName}: ${networks[networkName].IPAddress}`);
      return networks[networkName].IPAddress;
    }

    // Fallback: get first available network IP
    for (const [netName, net] of Object.entries(networks) as [string, { IPAddress?: string }][]) {
      console.log(`  Network ${netName} IP: "${net.IPAddress || "empty"}"`);
      if (net.IPAddress && isValidIP(net.IPAddress)) {
        return net.IPAddress;
      }
    }
  } catch (e) {
    console.log(`  Command failed: ${e}`);
  }
  return null;
}

function getRedroidHost(): string {
  // With network_mode: host, we need to find the container's IP via Docker/Podman
  const podName = process.env.POD_NAME;
  console.log(`POD_NAME: "${podName}"`);

  if (!podName) {
    console.error("POD_NAME environment variable not set, cannot resolve redroid container IP");
    process.exit(1);
  }

  // Try different container naming conventions (docker-compose uses dash, podman-compose may use underscore)
  const containerNames = [`${podName}-redroid-1`, `${podName}_redroid_1`];
  const networkName = `${podName}_internal`;
  const commands = ["podman", "docker"]; // Try podman first on Fedora

  console.log(`Looking for containers: ${containerNames.join(", ")}`);
  console.log(`Expected network: ${networkName}`);

  for (const cmd of commands) {
    for (const containerName of containerNames) {
      const ip = tryGetContainerIP(cmd, containerName, networkName);
      if (ip) {
        console.log(`Resolved redroid container IP: ${ip} (via ${cmd})`);
        return ip;
      }
    }
  }

  console.error(`Failed to resolve redroid container IP. Tried containers: ${containerNames.join(", ")} with podman and docker.`);
  console.error(`This setup requires rootful Docker/Podman (run with sudo). Rootless containers don't have routable IPs.`);
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
