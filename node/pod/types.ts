export type InputMessage =
  | {
      type: "drag";
      action: "start" | "move" | "end" | "cancel";
      pointerId: number;
      x: number;
      y: number;
    }
  | {
      type: "click";
      action: "down" | "up";
      button: 0 | 1 | 2;
      x: number;
      y: number;
    };
