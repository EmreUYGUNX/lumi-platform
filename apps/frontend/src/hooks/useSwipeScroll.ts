import { type RefObject, useEffect } from "react";

/**
 * Enables swipe/drag scrolling for horizontal carousels and sliders.
 * Keeps vertical scrolling intact while allowing pointer-based panning.
 */
export function useSwipeScroll<T extends HTMLElement>(ref: RefObject<T>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return () => {};

    let isPointerDown = false;
    let startX = 0;
    let scrollStart = 0;
    let activePointerId: number | undefined;
    const previousTouchAction = element.style.touchAction;

    const handlePointerDown = (event: PointerEvent) => {
      // Allow only primary button for mouse
      if (event.pointerType === "mouse" && event.button !== 0) return;

      isPointerDown = true;
      startX = event.clientX;
      scrollStart = element.scrollLeft;
      activePointerId = event.pointerId;
      element.style.touchAction = "pan-y";

      element.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;
      const delta = event.clientX - startX;
      element.scrollLeft = scrollStart - delta;
    };

    const endInteraction = (event?: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      element.style.touchAction = previousTouchAction;
      if (activePointerId !== undefined && event) {
        try {
          element.releasePointerCapture?.(activePointerId);
        } catch {
          // no-op if pointer capture is already released
        }
      }
      activePointerId = undefined;
    };

    element.addEventListener("pointerdown", handlePointerDown, { passive: true });
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", endInteraction);
    element.addEventListener("pointercancel", endInteraction);
    element.addEventListener("pointerleave", endInteraction);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", endInteraction);
      element.removeEventListener("pointercancel", endInteraction);
      element.removeEventListener("pointerleave", endInteraction);
      element.style.touchAction = previousTouchAction;
    };
  }, [ref]);
}
