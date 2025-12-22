/**
 * Signal Server WebSocket Module
 * Handles connection to the signaling server for WebRTC coordination
 */

// Get signal URL from config or use default
function getSignalUrl() {
  return window.CONFIG?.SIGNAL_URL || 'ws://localhost:8080';
}

/**
 * Signal connection class
 */
class SignalConnection {
  constructor() {
    this.ws = null;
    this.onOffer = null;
    this.onIceCandidate = null;
    this.onError = null;
    this.onDisconnect = null;
    this.onWorkerDisconnected = null;
  }

  /**
   * Connect to the signal server
   * @returns {Promise<void>}
   */
  async connect() {
    // Get auth token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const baseUrl = getSignalUrl();
      const url = `${baseUrl}?token=${encodeURIComponent(token)}`;
      console.log('Connecting to signal server');

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to signal server');
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        if (this.onError) {
          this.onError('Connection error');
        }
        reject(new Error('Failed to connect to signal server'));
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signal server');
        if (this.onDisconnect) {
          this.onDisconnect();
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    const msg = JSON.parse(event.data);

    if (msg.type !== 'ping') {
      console.log('Signal message:', msg.type);
    }

    switch (msg.type) {
      case 'ping':
        this.send({ type: 'pong' });
        break;

      case 'offer':
        if (this.onOffer) {
          this.onOffer(msg.sdp);
        }
        break;

      case 'ice-candidate':
        if (this.onIceCandidate && msg.candidate) {
          this.onIceCandidate(msg.candidate);
        }
        break;

      case 'error':
        console.error('Signal error:', msg.message);
        // Handle subscription required error - redirect to pricing
        if (msg.code === 'NO_SUBSCRIPTION') {
          alert('You need an active subscription to play. Redirecting to pricing...');
          window.location.href = '/pricing.html';
          return;
        }
        if (this.onError) {
          this.onError(msg.message);
        }
        break;

      case 'worker-disconnected':
        console.log('Worker disconnected');
        if (this.onWorkerDisconnected) {
          this.onWorkerDisconnected();
        }
        break;

      case 'shutdown':
        console.log('Server shutdown:', msg.reason);
        if (this.onError) {
          this.onError('Server shutdown: ' + msg.reason);
        }
        break;
    }
  }

  /**
   * Send a message to the signal server
   */
  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Request to start a streaming session
   */
  sendStart() {
    this.send({ type: 'start' });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(sdp) {
    this.send({ type: 'answer', sdp: sdp });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(candidate) {
    this.send({ type: 'ice-candidate', candidate: candidate });
  }

  /**
   * Notify server that WebRTC is connected
   */
  sendConnected() {
    this.send({ type: 'connected' });
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close the connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export for use in other modules
window.SignalConnection = SignalConnection;
