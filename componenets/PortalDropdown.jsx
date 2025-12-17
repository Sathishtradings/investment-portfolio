"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * PortalDropdown
 * - Renders children into document.body so it won't be clipped by overflow or stacking contexts.
 * - caller supplies anchorRect (DOMRect) to position the panel.
 */
export default function PortalDropdown({ open, anchorRect, children, width }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) {
      hostRef.current = document.createElement("div");
      document.body.appendChild(hostRef.current);
    }
    return () => {
      if (hostRef.current) {
        try { document.body.removeChild(hostRef.current); } catch (e) {}
        hostRef.current = null;
      }
    };
  }, []);

  if (!open || !hostRef.current || !anchorRect) return null;

  // compute position: prefer rendering below input; if not enough space, show above
  const padding = 6;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - (anchorRect.bottom + padding);
  const panelMaxHeight = 320;
  const willOpenBelow = spaceBelow > 120; // heuristic

  const style = {
    position: "absolute",
    left: anchorRect.left + window.scrollX,
    width: width || Math.max(280, anchorRect.width),
    zIndex: 2147483647, // extremely high to avoid clipping
    maxHeight: panelMaxHeight,
    overflowY: "auto",
    borderRadius: 8,
    boxShadow: "0 8px 30px rgba(2,6,23,0.6)",
    background: "rgba(0,0,0,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "6px",
    // choose top or bottom
    top: willOpenBelow ? (anchorRect.bottom + window.scrollY + 6) : (anchorRect.top + window.scrollY - panelMaxHeight - 6),
  };

  return createPortal(
    <div style={style} role="listbox" aria-expanded="true">
      {children}
    </div>,
    hostRef.current
  );
}
