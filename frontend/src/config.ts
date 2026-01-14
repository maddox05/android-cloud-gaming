const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const config = {
  SIGNAL_WS_URL: isLocalhost
    ? "ws://localhost:8080"
    : "wss://android-cloud-gaming-production.up.railway.app",
  SIGNAL_HTTP_URL: isLocalhost
    ? "http://localhost:8080"
    : "https://android-cloud-gaming-production.up.railway.app",
  SUPABASE_URL: "https://ztpnrydpwwdflohcomqe.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Q4cyEpySuQTxHkpSxscrKw_64vJYF0H",
  STRIPE_BILLING_URL:
    "https://billing.stripe.com/p/login/4gMeVdfY5c553jheYeew800",
};
