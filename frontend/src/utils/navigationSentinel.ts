import { websocketAPI } from "./websocket_api";
import { videoInputWebRTC } from "./video_and_input_webrtc";

let isSetup = false;

/**
 * Clears all connection state (WebSocket API and WebRTC)
 */
export function clearState(): void {
  console.log("[NavigationSentinel] Clearing connection state");
  videoInputWebRTC.close();
  websocketAPI.close();
}

/**
 * Sets up a sentinel that watches for browser back/forward navigation
 * and clears connection state when detected. Only runs once.
 */
export function setupNavigationSentinel(): void {
  if (isSetup) return;
  isSetup = true;

  window.addEventListener("popstate", () => {
    console.log("[NavigationSentinel] Back/forward navigation detected");
    clearState();
  });
}
