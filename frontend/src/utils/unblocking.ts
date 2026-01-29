import {
  isLocalhost,
  selectedSignalServerIndex,
  SIGNAL_SERVER_DOMAINS,
} from "../consts";
import axios from "axios";

// Finds a working signal server and redirects with ?s={index} if current one doesn't work
export async function findWorkingSignalServerDomain(): Promise<void> {
  if (isLocalhost) return;

  for (let i = 0; i < SIGNAL_SERVER_DOMAINS.length; i++) {
    const domain = SIGNAL_SERVER_DOMAINS[i];
    try {
      const res = await axios.get(`https://${domain}/test.txt`, {
        timeout: 5000,
      });
      if (res.data.trim() === "t67") {
        // Found working server
        if (i !== selectedSignalServerIndex) {
          // Different from current - redirect to update URL and reset state
          const url = new URL(window.location.href);
          url.searchParams.set("s", String(i));
          window.location.href = url.toString();
          return;
        }
        // Already on correct server
        console.log(`Using signal server: ${domain}`);
        return;
      }
    } catch {
      console.warn(`Signal server ${domain} failed, trying next...`);
    }
  }
  console.error("No working signal server found");
}
