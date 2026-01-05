import {
  MSG,
  type DragInputMessage,
  type ClickInputMessage,
  type InputMessage,
} from "../../../../shared/types";

// Using Percents works as on a screen depending on form factor,
// a item will be in different pixel positions but same relative position.
// so for example im playing COC and I squeeze the screen to a phone size, the center popup is still in the center
// and is the same amount of percent away from the left top etc.

export function createDragMessage(
  action: "start" | "move" | "end" | "cancel",
  e: PointerEvent,
  canvasRect: DOMRect
): DragInputMessage {
  console.log(canvasRect.width);
  return {
    type: MSG.DRAG,
    action,
    pointerId: e.pointerId,
    xPercent: (e.clientX - canvasRect.left) / canvasRect.width,
    yPercent: (e.clientY - canvasRect.top) / canvasRect.height,
  };
}

export function createClickMessage(
  action: "down" | "up",
  button: 0 | 1 | 2,
  e: MouseEvent,
  canvasRect: DOMRect
): ClickInputMessage {
  return {
    type: MSG.CLICK,
    action,
    button,
    xPercent: (e.clientX - canvasRect.left) / canvasRect.width,
    yPercent: (e.clientY - canvasRect.top) / canvasRect.height,
  };
}

export type { InputMessage };
