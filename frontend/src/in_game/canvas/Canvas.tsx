import { useRef, useEffect, useCallback } from "react";
import { createDragMessage, type InputMessage } from "./input";
import "./Canvas.css";

interface CanvasProps {
  sendInput: (msg: InputMessage) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export default function Canvas({ sendInput, onCanvasReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef(false);

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect();
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isPointerDownRef.current = true;

      const rect = getCanvasRect();
      if (!rect) return;
      const x = createDragMessage("start", e.nativeEvent, rect);
      console.log(x.xPercent, x.yPercent);
      sendInput(x);
    },
    [sendInput, getCanvasRect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerDownRef.current) return;
      e.preventDefault();

      const rect = getCanvasRect();
      if (!rect) return;

      sendInput(createDragMessage("move", e.nativeEvent, rect));
    },
    [sendInput, getCanvasRect]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isPointerDownRef.current = false;

      const rect = getCanvasRect();
      if (!rect) return;

      sendInput(createDragMessage("end", e.nativeEvent, rect));
    },
    [sendInput, getCanvasRect]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      isPointerDownRef.current = false;

      const rect = getCanvasRect();
      if (!rect) return;

      sendInput(createDragMessage("cancel", e.nativeEvent, rect));
    },
    [sendInput, getCanvasRect]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      const rect = getCanvasRect();
      if (!rect) return;

      sendInput(createDragMessage("end", e.nativeEvent, rect));
    },
    [sendInput, getCanvasRect]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="stream-container">
      <canvas
        ref={canvasRef}
        className="stream-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
