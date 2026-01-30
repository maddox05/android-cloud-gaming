export const SIGNAL_SERVER_DOMAINS = [
  "android-cloud-gaming-production.up.railway.app",
  "cloud-signal.commonground.click", // there is only 1 signal server these are just domains it can be accessed from
];
export const GAMES_DATABASE_LINKS = [];
export const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Check if URL has a server index param
const urlParams = new URLSearchParams(window.location.search);
const serverIndexParam = urlParams.get("s");
export const selectedSignalServerIndex =
  serverIndexParam !== null ? parseInt(serverIndexParam, 10) : 0;
const selectedSignalServerDomain =
  SIGNAL_SERVER_DOMAINS[selectedSignalServerIndex] ?? SIGNAL_SERVER_DOMAINS[0];

export const config = {
  SIGNAL_WS_URL: isLocalhost
    ? "ws://localhost:8080"
    : `wss://${selectedSignalServerDomain}`,
  SIGNAL_HTTP_URL: isLocalhost
    ? "http://localhost:8080"
    : `https://${selectedSignalServerDomain}`,
  SUPABASE_URL: "https://ztpnrydpwwdflohcomqe.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Q4cyEpySuQTxHkpSxscrKw_64vJYF0H",
  STRIPE_BILLING_URL:
    "https://billing.stripe.com/p/login/4gMeVdfY5c553jheYeew800",
};
