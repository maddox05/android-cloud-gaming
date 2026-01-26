import axios from "axios";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const SIGNAL_SERVER_DOMAINS = [
  "android-cloud-gaming-production.up.railway.app",
  "cloud-signal.commonground.click", // there is only 1 signal server these are just domains it can be accessed from
];

// Check if URL has a server index param
const urlParams = new URLSearchParams(window.location.search);
const serverIndexParam = urlParams.get("s");
const serverIndex =
  serverIndexParam !== null ? parseInt(serverIndexParam, 10) : 0;
const selectedDomain =
  SIGNAL_SERVER_DOMAINS[serverIndex] ?? SIGNAL_SERVER_DOMAINS[0];

export const config = {
  SIGNAL_WS_URL: isLocalhost
    ? "ws://localhost:8080"
    : `wss://${selectedDomain}`,
  SIGNAL_HTTP_URL: isLocalhost
    ? "http://localhost:8080"
    : `https://${selectedDomain}`,
  SUPABASE_URL: "https://ztpnrydpwwdflohcomqe.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Q4cyEpySuQTxHkpSxscrKw_64vJYF0H",
  STRIPE_BILLING_URL:
    "https://billing.stripe.com/p/login/4gMeVdfY5c553jheYeew800",
};

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
        if (i !== serverIndex) {
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
