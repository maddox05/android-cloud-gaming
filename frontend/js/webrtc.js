/**
 * WebRTC Module
 * Handles peer connection setup and data channels for streaming
 */

class StreamConnection {
  constructor() {
    this.pc = null;
    this.videoChannel = null;
    this.inputChannel = null;

    // Callbacks
    this.onVideoData = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onInputChannelReady = null;
  }

  /**
   * Handle incoming offer and create answer
   * @param {string} offerSdp - SDP offer from worker
   * @param {SignalConnection} signal - Signal connection for sending answer/ice
   * @returns {Promise<void>}
   */
  async handleOffer(offerSdp, signal) {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Handle incoming data channels
    this.pc.ondatachannel = (event) => {
      this.handleDataChannel(event.channel, signal);
    };

    // Send ICE candidates to signal server
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        signal.sendIceCandidate(event.candidate);
      }
    };

    // Monitor connection state
    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);

      if (this.pc.connectionState === 'connected') {
        if (this.onConnected) {
          this.onConnected();
        }
      } else if (this.pc.connectionState === 'failed' ||
                 this.pc.connectionState === 'disconnected') {
        if (this.onDisconnected) {
          this.onDisconnected();
        }
      }
    };

    // Set remote description and create answer
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // Send answer to signal server
    signal.sendAnswer(answer.sdp);
  }

  /**
   * Handle incoming data channel
   */
  handleDataChannel(channel, signal) {
    console.log('Data channel:', channel.label);

    if (channel.label === 'video') {
      this.videoChannel = channel;
      channel.binaryType = 'arraybuffer';

      channel.onopen = () => {
        console.log('Video channel open');
        // Notify signal server that WebRTC is connected
        signal.sendConnected();
      };

      channel.onmessage = (event) => {
        if (this.onVideoData) {
          this.onVideoData(event.data);
        }
      };

    } else if (channel.label === 'input') {
      this.inputChannel = channel;

      channel.onopen = () => {
        console.log('Input channel ready');
        if (this.onInputChannelReady) {
          this.onInputChannelReady();
        }
      };
    }
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate) {
    if (this.pc) {
      await this.pc.addIceCandidate(candidate);
    }
  }

  /**
   * Send input message through input channel
   */
  sendInput(msg) {
    if (this.inputChannel && this.inputChannel.readyState === 'open') {
      this.inputChannel.send(JSON.stringify(msg));
    }
  }

  /**
   * Check if input channel is ready
   */
  isInputReady() {
    return this.inputChannel && this.inputChannel.readyState === 'open';
  }

  /**
   * Close the connection
   */
  close() {
    if (this.videoChannel) {
      this.videoChannel.close();
      this.videoChannel = null;
    }
    if (this.inputChannel) {
      this.inputChannel.close();
      this.inputChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

// Export for use in other modules
window.StreamConnection = StreamConnection;
