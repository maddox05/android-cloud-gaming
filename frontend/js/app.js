/**
 * App Page Module
 * Handles WebRTC streaming connection for game play
 */

// Page state
let signal = null;
let stream = null;
let decoder = null;
let inputHandler = null;
let gameId = null;

/**
 * Initialize the app page
 */
async function initAppPage() {
  // Get game ID from URL params
  const params = new URLSearchParams(window.location.search);
  gameId = params.get('game');

  // Check we have a game ID
  if (!gameId) {
    alert('No game specified. Please select a game from the home page.');
    window.location.href = 'index.html';
    return;
  }

  // Clear any stored intent
  sessionStorage.removeItem('gameIntent');

  // Update page title with game name
  const gameName = getGameName(gameId);
  document.getElementById('game-title').textContent = gameName;

  // Start connection
  await startStreaming();
}

/**
 * Get display name for a game ID
 */
function getGameName(id) {
  const games = {
    'com.supercell.clashroyale': 'Clash Royale'
  };
  return games[id] || id;
}

/**
 * Update status display
 */
function setStatus(text, type) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = 'status-bar' + (type ? ' ' + type : '');
  }
}

/**
 * Show/hide loading overlay
 */
function setLoading(show, message) {
  const overlay = document.getElementById('loading-overlay');
  const msgEl = document.getElementById('loading-message');

  if (overlay) {
    if (show) {
      overlay.classList.remove('hidden');
      if (msgEl) msgEl.textContent = message || 'Loading...';
    } else {
      overlay.classList.add('hidden');
    }
  }
}

/**
 * Start the streaming connection
 */
async function startStreaming() {
  setLoading(true, 'Connecting to server...');
  setStatus('Connecting...');

  try {
    // Create signal connection
    signal = new SignalConnection();

    // Set up signal callbacks
    signal.onOffer = handleOffer;
    signal.onIceCandidate = handleIceCandidate;
    signal.onError = handleError;
    signal.onDisconnect = handleDisconnect;
    signal.onWorkerDisconnected = handleWorkerDisconnected;

    // Connect to signal server
    await signal.connect();
    setStatus('Connected to server');
    setLoading(true, 'Waiting for worker...');

    // Request to start streaming
    signal.sendStart();

  } catch (error) {
    console.error('Failed to connect:', error);
    setStatus('Connection failed', 'error');
    setLoading(false);
    alert('Failed to connect to server. Returning to home page.');
    window.location.href = 'index.html';
  }
}

/**
 * Handle WebRTC offer from worker
 */
async function handleOffer(sdp) {
  console.log('Received offer');
  setLoading(true, 'Establishing stream...');

  try {
    // Create stream connection
    stream = new StreamConnection();

    // Set up stream callbacks
    stream.onVideoData = handleVideoData;
    stream.onConnected = handleStreamConnected;
    stream.onDisconnected = handleStreamDisconnected;

    // Handle offer and send answer
    await stream.handleOffer(sdp, signal);

  } catch (error) {
    console.error('Failed to handle offer:', error);
    setStatus('Stream failed', 'error');
    setLoading(false);
  }
}

/**
 * Handle ICE candidate from signal server
 */
async function handleIceCandidate(candidate) {
  if (stream) {
    await stream.addIceCandidate(candidate);
  }
}

/**
 * Handle video data from stream
 */
function handleVideoData(data) {
  if (decoder) {
    decoder.appendData(data);
  }
}

/**
 * Handle stream connected
 */
function handleStreamConnected() {
  console.log('Stream connected');
  setStatus('Streaming', 'connected');
  setLoading(false);

  // Initialize decoder
  const canvas = document.getElementById('stream-canvas');
  decoder = new H264Decoder(canvas);

  // Initialize input handler
  inputHandler = new InputHandler(canvas, stream);
}

/**
 * Handle stream disconnected
 */
function handleStreamDisconnected() {
  console.log('Stream disconnected');
  setStatus('Disconnected', 'error');
  cleanup();
}

/**
 * Handle signal error
 */
function handleError(message) {
  console.error('Signal error:', message);
  setStatus('Error: ' + message, 'error');
  setLoading(false);

  // If no workers available, go back to home
  if (message.includes('No workers available')) {
    alert('No game servers available. Please try again later.');
    window.location.href = 'index.html';
  }
}

/**
 * Handle signal disconnect
 */
function handleDisconnect() {
  console.log('Signal disconnected');
  if (decoder) {
    // Only show error if we were connected
    setStatus('Connection lost', 'error');
  }
}

/**
 * Handle worker disconnected
 */
function handleWorkerDisconnected() {
  console.log('Worker disconnected');
  setStatus('Game server disconnected', 'error');
  setLoading(false);
  cleanup();
  alert('Game server disconnected. Returning to home page.');
  window.location.href = 'index.html';
}

/**
 * Go back to home page
 */
function goHome() {
  cleanup();
  window.location.href = 'index.html';
}

/**
 * Cleanup all connections
 */
function cleanup() {
  if (decoder) {
    decoder.reset();
    decoder = null;
  }
  if (inputHandler) {
    inputHandler.destroy();
    inputHandler = null;
  }
  if (stream) {
    stream.close();
    stream = null;
  }
  if (signal) {
    signal.close();
    signal = null;
  }
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAppPage);
