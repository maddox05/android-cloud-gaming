/**
 * H.264 Decoder Module
 * Handles NAL unit parsing and video decoding using WebCodecs API
 */

class H264Decoder {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.decoder = null;
    this.buffer = new Uint8Array(0);
    this.sps = null;
    this.pps = null;
    this.timestamp = 0;
    this.configured = false;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.onDimensionsChanged = null;
  }

  /**
   * Append incoming data to buffer and process
   */
  appendData(data) {
    const incoming = new Uint8Array(data);
    console.log('Received chunk:', incoming.length, 'bytes');

    const newBuffer = new Uint8Array(this.buffer.length + incoming.length);
    newBuffer.set(this.buffer, 0);
    newBuffer.set(incoming, this.buffer.length);
    this.buffer = newBuffer;

    this.processBuffer();
  }

  /**
   * Find NAL units in buffer and process them
   */
  processBuffer() {
    const nalUnits = [];
    let lastStart = -1;

    // Find all NAL start codes
    for (let i = 0; i < this.buffer.length - 4; i++) {
      // Check for 4-byte start code (00 00 00 01)
      if (this.buffer[i] === 0 && this.buffer[i + 1] === 0 &&
          this.buffer[i + 2] === 0 && this.buffer[i + 3] === 1) {
        if (lastStart !== -1) {
          nalUnits.push(this.buffer.slice(lastStart, i));
        }
        lastStart = i;
        i += 3;
      }
      // Check for 3-byte start code (00 00 01)
      else if (this.buffer[i] === 0 && this.buffer[i + 1] === 0 && this.buffer[i + 2] === 1) {
        if (lastStart !== -1) {
          nalUnits.push(this.buffer.slice(lastStart, i));
        }
        lastStart = i;
        i += 2;
      }
    }

    // Keep incomplete data in buffer (from last start code to end)
    if (lastStart !== -1 && nalUnits.length > 0) {
      this.buffer = this.buffer.slice(lastStart);
    } else if (lastStart === -1) {
      // No start codes found, clear buffer if it's getting too large
      if (this.buffer.length > 1024 * 1024) {
        console.warn('Buffer overflow, clearing');
        this.buffer = new Uint8Array(0);
      }
    }

    // Process found NAL units
    for (const nal of nalUnits) {
      this.processNAL(nal);
    }
  }

  /**
   * Process a single NAL unit
   */
  processNAL(nal) {
    if (nal.length < 5) return;

    // Get NAL type (5 bits after start code)
    const startCodeLen = (nal[2] === 1) ? 3 : 4;
    const nalType = nal[startCodeLen] & 0x1F;

    switch (nalType) {
      case 7: // SPS
        this.sps = nal;
        console.log('Got SPS, length:', nal.length);
        try {
          const dims = this.parseDimensionsFromSPS(nal);
          this.videoWidth = dims.width;
          this.videoHeight = dims.height;
          console.log('Video dimensions:', dims.width, 'x', dims.height);
          if (this.onDimensionsChanged) {
            this.onDimensionsChanged(dims.width, dims.height);
          }
        } catch (e) {
          console.error('Failed to parse SPS dimensions:', e);
        }
        this.tryConfigureDecoder();
        break;

      case 8: // PPS
        this.pps = nal;
        console.log('Got PPS, length:', nal.length);
        this.tryConfigureDecoder();
        break;

      case 5: // IDR (keyframe)
        this.decodeFrame(nal, true);
        break;

      case 1: // Non-IDR (P-frame)
        this.decodeFrame(nal, false);
        break;
    }
  }

  /**
   * Parse SPS to get codec string
   */
  parseCodecFromSPS(sps) {
    const startCodeLen = (sps[2] === 1) ? 3 : 4;
    const profileIdc = sps[startCodeLen + 1];
    const constraints = sps[startCodeLen + 2];
    const levelIdc = sps[startCodeLen + 3];

    function hex(n) {
      return n.toString(16).padStart(2, '0').toUpperCase();
    }
    return `avc1.${hex(profileIdc)}${hex(constraints)}${hex(levelIdc)}`;
  }

  /**
   * Parse SPS to get video dimensions
   */
  parseDimensionsFromSPS(sps) {
    const startCodeLen = (sps[2] === 1) ? 3 : 4;
    const rbsp = this.removeEmulationPrevention(sps.slice(startCodeLen + 1));

    let bitPos = 0;

    function readBits(n) {
      let val = 0;
      for (let i = 0; i < n; i++) {
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = 7 - (bitPos % 8);
        val = (val << 1) | ((rbsp[byteIdx] >> bitIdx) & 1);
        bitPos++;
      }
      return val;
    }

    function readUE() {
      let zeros = 0;
      while (readBits(1) === 0) zeros++;
      if (zeros === 0) return 0;
      return (1 << zeros) - 1 + readBits(zeros);
    }

    const profileIdc = readBits(8);
    readBits(8); // constraints
    readBits(8); // level
    readUE(); // seq_parameter_set_id

    if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(profileIdc)) {
      const chromaFormat = readUE();
      if (chromaFormat === 3) readBits(1);
      readUE();
      readUE();
      readBits(1);
      if (readBits(1)) {
        for (let i = 0; i < (chromaFormat !== 3 ? 8 : 12); i++) {
          if (readBits(1)) {
            const size = i < 6 ? 16 : 64;
            let last = 8, next = 8;
            for (let j = 0; j < size; j++) {
              if (next !== 0) next = (last + readUE()) & 255;
              last = next === 0 ? last : next;
            }
          }
        }
      }
    }

    readUE(); // log2_max_frame_num
    const picOrderCntType = readUE();
    if (picOrderCntType === 0) {
      readUE();
    } else if (picOrderCntType === 1) {
      readBits(1);
      readUE();
      readUE();
      const n = readUE();
      for (let i = 0; i < n; i++) readUE();
    }
    readUE(); // max_num_ref_frames
    readBits(1); // gaps_in_frame_num_allowed

    const picWidthInMbs = readUE() + 1;
    const picHeightInMapUnits = readUE() + 1;
    const frameMbsOnly = readBits(1);
    if (!frameMbsOnly) readBits(1);
    readBits(1); // direct_8x8_inference

    let cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0;
    if (readBits(1)) {
      cropLeft = readUE();
      cropRight = readUE();
      cropTop = readUE();
      cropBottom = readUE();
    }

    const width = picWidthInMbs * 16 - (cropLeft + cropRight) * 2;
    const height = (2 - frameMbsOnly) * picHeightInMapUnits * 16 - (cropTop + cropBottom) * 2;

    return { width, height };
  }

  /**
   * Remove emulation prevention bytes from NAL data
   */
  removeEmulationPrevention(data) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i + 2 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 3) {
        result.push(0, 0);
        i += 2;
      } else {
        result.push(data[i]);
      }
    }
    return new Uint8Array(result);
  }

  /**
   * Configure decoder once we have SPS and PPS
   */
  tryConfigureDecoder() {
    if (!this.sps || !this.pps || this.configured) return;

    const codec = this.parseCodecFromSPS(this.sps);
    console.log('Configuring decoder with codec:', codec);

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
        frame.close();
      },
      error: (e) => {
        console.error('Decoder error:', e);
      }
    });

    try {
      this.decoder.configure({
        codec: codec,
        optimizeForLatency: true,
      });
      this.configured = true;
      console.log('Decoder configured successfully');
    } catch (e) {
      console.error('Failed to configure decoder:', e);
      // Try fallback codec
      try {
        this.decoder.configure({
          codec: 'avc1.42E01E', // Baseline Profile Level 3.0
          optimizeForLatency: true,
        });
        this.configured = true;
        console.log('Decoder configured with fallback codec');
      } catch (e2) {
        console.error('Fallback codec also failed:', e2);
      }
    }
  }

  /**
   * Decode a video frame
   */
  decodeFrame(nal, isKeyframe) {
    if (!this.decoder || this.decoder.state !== 'configured') {
      return;
    }

    // For keyframes, prepend SPS and PPS
    let frameData = nal;
    if (isKeyframe && this.sps && this.pps) {
      const combined = new Uint8Array(this.sps.length + this.pps.length + nal.length);
      combined.set(this.sps, 0);
      combined.set(this.pps, this.sps.length);
      combined.set(nal, this.sps.length + this.pps.length);
      frameData = combined;
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: this.timestamp,
        data: frameData,
      });
      this.decoder.decode(chunk);
      this.timestamp += 33333; // ~30fps in microseconds
    } catch (e) {
      // Skip invalid chunks silently
    }
  }

  /**
   * Reset decoder state
   */
  reset() {
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
    this.buffer = new Uint8Array(0);
    this.sps = null;
    this.pps = null;
    this.timestamp = 0;
    this.configured = false;
    this.videoWidth = 0;
    this.videoHeight = 0;
  }
}

// Export for use in other modules
window.H264Decoder = H264Decoder;
