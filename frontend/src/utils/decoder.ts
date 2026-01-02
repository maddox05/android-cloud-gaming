import { NAL_TYPE } from "../types";

export class H264Decoder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private decoder: VideoDecoder | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private sps: Uint8Array | null = null;
  private pps: Uint8Array | null = null;
  private timestamp: number = 0;
  private configured: boolean = false;
  private videoWidth: number = 0;
  private videoHeight: number = 0;
  private resetVideo: (() => void) | null = null;
  private lastResetTime: number = 0;
  private readonly RESET_COOLDOWN_MS = 10000; // 10 seconds

  onDimensionsChanged: ((width: number, height: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, resetVideo?: () => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resetVideo = resetVideo ?? null;
  }

  private requestVideoReset(): void {
    const now = Date.now();
    if (this.resetVideo && now - this.lastResetTime >= this.RESET_COOLDOWN_MS) {
      this.lastResetTime = now;
      console.log("Requesting video reset from server");
      this.resetVideo();
    }
  }

  appendData(data: ArrayBuffer): void {
    const incoming = new Uint8Array(data);

    const newBuffer = new Uint8Array(this.buffer.length + incoming.length);
    newBuffer.set(this.buffer, 0);
    newBuffer.set(incoming, this.buffer.length);
    this.buffer = newBuffer;

    this.processBuffer();
  }

  private processBuffer(): void {
    const nalUnits: Uint8Array[] = [];
    let lastStart = -1;

    for (let i = 0; i < this.buffer.length - 4; i++) {
      // Check for 4-byte start code (00 00 00 01)
      if (
        this.buffer[i] === 0 &&
        this.buffer[i + 1] === 0 &&
        this.buffer[i + 2] === 0 &&
        this.buffer[i + 3] === 1
      ) {
        if (lastStart !== -1) {
          nalUnits.push(this.buffer.slice(lastStart, i));
        }
        lastStart = i;
        i += 3;
      }
      // Check for 3-byte start code (00 00 01)
      else if (
        this.buffer[i] === 0 &&
        this.buffer[i + 1] === 0 &&
        this.buffer[i + 2] === 1
      ) {
        if (lastStart !== -1) {
          nalUnits.push(this.buffer.slice(lastStart, i));
        }
        lastStart = i;
        i += 2;
      }
    }

    // Keep incomplete data in buffer
    if (lastStart !== -1 && nalUnits.length > 0) {
      this.buffer = this.buffer.slice(lastStart);
    } else if (lastStart === -1) {
      // No start codes found, clear buffer if too large
      if (this.buffer.length > 1024 * 1024) {
        console.warn("Buffer overflow, clearing");
        this.buffer = new Uint8Array(0);
      }
    }

    for (const nal of nalUnits) {
      this.processNAL(nal);
    }
  }

  private processNAL(nal: Uint8Array): void {
    if (nal.length < 5) return;

    const startCodeLen = nal[2] === 1 ? 3 : 4;
    const nalType = nal[startCodeLen] & 0x1f;

    switch (nalType) {
      case NAL_TYPE.SPS:
        this.sps = nal;
        try {
          const dims = this.parseDimensionsFromSPS(nal);
          this.videoWidth = dims.width;
          this.videoHeight = dims.height;
          console.log("Parsed SPS");
          console.log("Video dimensions:", dims.width, "x", dims.height);
          this.onDimensionsChanged?.(dims.width, dims.height);
        } catch (e) {
          console.error("Failed to parse SPS dimensions:", e);
        }
        this.tryConfigureDecoder();
        break;

      case NAL_TYPE.PPS:
        console.log("Got PPS");
        this.pps = nal;
        this.tryConfigureDecoder();
        break;

      case NAL_TYPE.IDR:
        console.log("I GOT A IDR FRAME");
        this.decodeFrame(nal, true);
        break;

      case NAL_TYPE.NON_IDR:
        this.decodeFrame(nal, false);
        break;
    }
  }

  private parseCodecFromSPS(sps: Uint8Array): string {
    const startCodeLen = sps[2] === 1 ? 3 : 4;
    const profileIdc = sps[startCodeLen + 1];
    const constraints = sps[startCodeLen + 2];
    const levelIdc = sps[startCodeLen + 3];

    const hex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
    return `avc1.${hex(profileIdc)}${hex(constraints)}${hex(levelIdc)}`;
  }

  private parseDimensionsFromSPS(sps: Uint8Array): {
    width: number;
    height: number;
  } {
    const startCodeLen = sps[2] === 1 ? 3 : 4;
    const rbsp = this.removeEmulationPrevention(sps.slice(startCodeLen + 1));

    let bitPos = 0;

    const readBits = (n: number): number => {
      let val = 0;
      for (let i = 0; i < n; i++) {
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = 7 - (bitPos % 8);
        val = (val << 1) | ((rbsp[byteIdx] >> bitIdx) & 1);
        bitPos++;
      }
      return val;
    };

    const readUE = (): number => {
      let zeros = 0;
      while (readBits(1) === 0) zeros++;
      if (zeros === 0) return 0;
      return (1 << zeros) - 1 + readBits(zeros);
    };

    const profileIdc = readBits(8);
    readBits(8); // constraints
    readBits(8); // level
    readUE(); // seq_parameter_set_id

    if (
      [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(
        profileIdc
      )
    ) {
      const chromaFormat = readUE();
      if (chromaFormat === 3) readBits(1);
      readUE();
      readUE();
      readBits(1);
      if (readBits(1)) {
        for (let i = 0; i < (chromaFormat !== 3 ? 8 : 12); i++) {
          if (readBits(1)) {
            const size = i < 6 ? 16 : 64;
            let last = 8,
              next = 8;
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

    let cropLeft = 0,
      cropRight = 0,
      cropTop = 0,
      cropBottom = 0;
    if (readBits(1)) {
      cropLeft = readUE();
      cropRight = readUE();
      cropTop = readUE();
      cropBottom = readUE();
    }

    const width = picWidthInMbs * 16 - (cropLeft + cropRight) * 2;
    const height =
      (2 - frameMbsOnly) * picHeightInMapUnits * 16 -
      (cropTop + cropBottom) * 2;

    return { width, height };
  }

  private removeEmulationPrevention(data: Uint8Array): Uint8Array {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (
        i + 2 < data.length &&
        data[i] === 0 &&
        data[i + 1] === 0 &&
        data[i + 2] === 3
      ) {
        result.push(0, 0);
        i += 2;
      } else {
        result.push(data[i]);
      }
    }
    return new Uint8Array(result);
  }

  private tryConfigureDecoder(): void {
    if (!this.sps || !this.pps || this.configured) return;

    const codec = this.parseCodecFromSPS(this.sps);
    console.log("Configuring decoder with codec:", codec);

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
        frame.close();
      },
      error: (e) => {
        console.error("Decoder error:", e);
        // Request video reset from server to get fresh SPS/PPS/IDR
        this.reset();

        alert(
          "Video decoder error occurred, requesting video reset, you may have to reconnect. (sorry!)"
        );
        this.requestVideoReset();
      },
    });

    try {
      this.decoder.configure({
        codec,
        optimizeForLatency: true,
      });
      this.configured = true;
      console.log("Decoder configured successfully");
    } catch (e) {
      console.error("Failed to configure decoder:", e);
      // Try fallback codec
      try {
        this.decoder.configure({
          codec: "avc1.42E00A",
          optimizeForLatency: true,
        });
        this.configured = true;
        console.log("Decoder configured with fallback codec");
      } catch (e2) {
        console.error("Fallback codec also failed:", e2);
      }
    }
  }

  private decodeFrame(nal: Uint8Array, isKeyframe: boolean): void {
    if (!this.decoder || this.decoder.state !== "configured") {
      console.log("Decoder not configured, skipping frame");
      // Request video reset to get fresh SPS/PPS/IDR sequence
      this.requestVideoReset();
      return;
    }

    // For keyframes, prepend SPS and PPS
    let frameData = nal;
    if (isKeyframe && this.sps && this.pps) {
      const combined = new Uint8Array(
        this.sps.length + this.pps.length + nal.length
      );
      combined.set(this.sps, 0);
      combined.set(this.pps, this.sps.length);
      combined.set(nal, this.sps.length + this.pps.length);
      frameData = combined;
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? "key" : "delta",
        timestamp: this.timestamp,
        data: frameData,
      });
      this.decoder.decode(chunk);
      this.timestamp += 33333; // ~30fps in microseconds
    } catch {
      // Skip invalid chunks silently
    }
  }

  reset(): void {
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
    this.lastResetTime = 0;
  }

  getVideoDimensions(): { width: number; height: number } {
    return { width: this.videoWidth, height: this.videoHeight };
  }
}
