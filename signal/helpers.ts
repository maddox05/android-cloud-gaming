import { MAX_SESSION_TIME_MS } from "../shared/const.js";

interface CloudflareTurnResponse {
  iceServers: {
    urls: string[];
    username?: string;
    credential?: string;
  }[];
}

/**
 * Generate TURN credentials from Cloudflare.
 * Filters out STUN URLs and port 53 URLs.
 * Returns null if API call fails or credentials are not configured.
 */
export async function generateTurnCredentials(): Promise<
  RTCIceServer[] | null
> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    console.warn("Cloudflare TURN not configured, skipping");
    return null;
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: MAX_SESSION_TIME_MS / 1000 }), // TTL must be in seconds
      }
    );

    if (!response.ok) {
      console.error(
        `Cloudflare TURN API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data: CloudflareTurnResponse = await response.json();

    // Filter: keep only TURN (not STUN), exclude port 53
    const turnServers: RTCIceServer[] = [];
    for (const server of data.iceServers) {
      const filteredUrls = server.urls.filter((url: string) => {
        // Must be turn or turns (not stun)
        if (!url.startsWith("turn:") && !url.startsWith("turns:")) {
          return false;
        }
        // Exclude port 53
        if (url.includes(":53?") || url.includes(":53/")) {
          return false;
        }
        if (url.includes("transport=tcp")) {
          return false;
        }
        return true;
      });

      if (filteredUrls.length > 0) {
        turnServers.push({
          urls: filteredUrls,
          username: server.username,
          credential: server.credential,
        });
      }
    }

    console.log(
      `Generated ${turnServers.length} TURN server(s) from Cloudflare`
    );
    return turnServers.length > 0 ? turnServers : null;
  } catch (error) {
    console.error("Failed to generate Cloudflare TURN credentials:", error);
    return null;
  }
}
