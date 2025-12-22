/**
 * Input Handler Module
 * Handles touch and mouse input on the streaming canvas
 */

class InputHandler {
  constructor(canvas, streamConnection) {
    this.canvas = canvas;
    this.stream = streamConnection;
    this.isPointerDown = false;

    this.setupEventListeners();
  }

  /**
   * Calculate percentage position within canvas
   */
  getPercentPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      xPercent: (clientX - rect.left) / rect.width,
      yPercent: (clientY - rect.top) / rect.height
    };
  }

  /**
   * Send input message to stream
   */
  sendInput(msg) {
    if (this.stream) {
      this.stream.sendInput(msg);
    }
  }

  /**
   * Setup all event listeners on the canvas
   */
  setupEventListeners() {
    // Prevent context menu
    this.canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });

    // Pointer down
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.isPointerDown = true;

      const pos = this.getPercentPosition(e.clientX, e.clientY);
      this.sendInput({
        type: 'drag',
        action: 'start',
        pointerId: e.pointerId,
        xPercent: pos.xPercent,
        yPercent: pos.yPercent
      });
    });

    // Pointer move
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;
      e.preventDefault();

      const pos = this.getPercentPosition(e.clientX, e.clientY);
      this.sendInput({
        type: 'drag',
        action: 'move',
        pointerId: e.pointerId,
        xPercent: pos.xPercent,
        yPercent: pos.yPercent
      });
    });

    // Pointer up
    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      this.isPointerDown = false;

      const pos = this.getPercentPosition(e.clientX, e.clientY);
      this.sendInput({
        type: 'drag',
        action: 'end',
        pointerId: e.pointerId,
        xPercent: pos.xPercent,
        yPercent: pos.yPercent
      });
    });

    // Pointer cancel
    this.canvas.addEventListener('pointercancel', (e) => {
      this.isPointerDown = false;
      this.sendInput({
        type: 'drag',
        action: 'cancel',
        pointerId: e.pointerId,
        xPercent: 0,
        yPercent: 0
      });
    });

    // Pointer leave (treat as cancel if still down)
    this.canvas.addEventListener('pointerleave', (e) => {
      if (this.isPointerDown) {
        this.isPointerDown = false;
        const pos = this.getPercentPosition(e.clientX, e.clientY);
        this.sendInput({
          type: 'drag',
          action: 'end',
          pointerId: e.pointerId,
          xPercent: pos.xPercent,
          yPercent: pos.yPercent
        });
      }
    });
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    // Event listeners will be garbage collected with the canvas
    this.canvas = null;
    this.stream = null;
  }
}

// Export for use in other modules
window.InputHandler = InputHandler;
