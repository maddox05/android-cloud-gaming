import { MSG, type DragInputMessage, type ClickInputMessage, type InputMessage } from "../../../../shared/types";

export function createDragMessage(
  action: "start" | "move" | "end" | "cancel",
  e: PointerEvent,
  canvasRect: DOMRect
): DragInputMessage {
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
