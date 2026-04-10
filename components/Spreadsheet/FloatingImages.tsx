"use client";

import { useCallback, useRef, useState } from "react";
import { SheetImage } from "./types";

interface Props {
  images: SheetImage[];
  onUpdate: (id: string, patch: Partial<SheetImage>) => void;
  onRemove: (id: string) => void;
}

const HANDLE_SIZE = 8;
const MIN_SIZE = 40;

type ResizeSide = "rm" | "mb" | "rb";

export function FloatingImages({ images, onUpdate, onRemove }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragState = useRef<{
    type: "move" | "resize";
    side?: ResizeSide;
    startX: number; startY: number;
    origLeft: number; origTop: number;
    origW: number; origH: number;
  } | null>(null);

  const onMoveStart = useCallback((e: React.MouseEvent, img: SheetImage) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveId(img.id);
    dragState.current = {
      type: "move",
      startX: e.clientX, startY: e.clientY,
      origLeft: img.left, origTop: img.top,
      origW: img.width, origH: img.height,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      onUpdate(img.id, {
        left: Math.max(0, dragState.current.origLeft + ev.clientX - dragState.current.startX),
        top: Math.max(0, dragState.current.origTop + ev.clientY - dragState.current.startY),
      });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onUpdate]);

  const onResizeStart = useCallback((e: React.MouseEvent, img: SheetImage, side: ResizeSide) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      type: "resize", side,
      startX: e.clientX, startY: e.clientY,
      origLeft: img.left, origTop: img.top,
      origW: img.width, origH: img.height,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      const patch: Partial<SheetImage> = {};
      if (side === "rm" || side === "rb") patch.width = Math.max(MIN_SIZE, dragState.current.origW + dx);
      if (side === "mb" || side === "rb") patch.height = Math.max(MIN_SIZE, dragState.current.origH + dy);
      onUpdate(img.id, patch);
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onUpdate]);

  if (!images.length) return null;

  return (
    <>
      {images.map(img => {
        const isActive = img.id === activeId;
        return (
          <div
            key={img.id}
            onMouseDown={(e) => { setActiveId(img.id); e.stopPropagation(); }}
            style={{
              position: "absolute",
              left: img.left, top: img.top,
              width: img.width, height: img.height,
              userSelect: "none",
              zIndex: isActive ? 20 : 10,
            }}
          >
            <img
              src={img.src}
              alt=""
              draggable={false}
              onMouseDown={(e) => onMoveStart(e, img)}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", cursor: "move" }}
            />

            {isActive && (
              <>
                <div style={{ position: "absolute", inset: 0, border: "2px solid #a855f7", pointerEvents: "none" }} />

                {/* Delete */}
                <div
                  onMouseDown={(e) => { e.stopPropagation(); onRemove(img.id); setActiveId(null); }}
                  style={{
                    position: "absolute", top: -10, right: -10,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#ef4444", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, cursor: "pointer", zIndex: 30,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                    lineHeight: 1,
                  }}
                >×</div>

                {/* Resize handles */}
                {(["rm", "mb", "rb"] as ResizeSide[]).map(side => (
                  <div
                    key={side}
                    onMouseDown={(e) => onResizeStart(e, img, side)}
                    style={{
                      position: "absolute",
                      width: HANDLE_SIZE, height: HANDLE_SIZE,
                      background: "#a855f7", border: "1px solid white",
                      borderRadius: 2,
                      cursor: side === "rm" ? "ew-resize" : side === "mb" ? "ns-resize" : "nwse-resize",
                      ...(side === "rm"
                        ? { right: -HANDLE_SIZE / 2, top: "50%", transform: "translateY(-50%)" }
                        : side === "mb"
                        ? { bottom: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)" }
                        : { right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 }),
                    }}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {activeId && (
        <div
          onClick={() => setActiveId(null)}
          style={{ position: "absolute", inset: 0, zIndex: 5 }}
        />
      )}
    </>
  );
}
