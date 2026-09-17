"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Width of the element in px, tracked with ResizeObserver. Starts at
 * `fallback` so server and first client render agree; charts reserve their
 * height independently, so a later width update never shifts layout.
 */
export function useMeasuredWidth<T extends HTMLElement>(fallback = 300) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? fallback);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
