import { useEffect, useRef, useCallback } from 'react';

export interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTapHold?: () => void;
  onPinch?: (scale: number) => void;
  onDoubleTap?: () => void;
}

interface TouchStart {
  x: number;
  y: number;
  timestamp: number;
}

const SWIPE_THRESHOLD = 50; // pixels
const SWIPE_TIME_THRESHOLD = 500; // ms
const TAP_HOLD_TIME = 500; // ms

/**
 * Hook for touch gesture detection (swipe, tap-hold, pinch, double-tap)
 */
export function useGestures(
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers
): void {
  const touchStartRef = useRef<TouchStart | null>(null);
  const touchStartRef2 = useRef<TouchStart | null>(null); // For pinch detection
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
          };

          // Set tap-hold timeout
          tapTimeoutRef.current = setTimeout(() => {
            handlers.onTapHold?.();
          }, TAP_HOLD_TIME);
        }
      } else if (event.touches.length === 2) {
        // Pinch start
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        if (touch1 && touch2) {
          touchStartRef.current = {
            x: touch1.clientX,
            y: touch1.clientY,
            timestamp: Date.now(),
          };
          touchStartRef2.current = {
            x: touch2.clientX,
            y: touch2.clientY,
            timestamp: Date.now(),
          };
        }
      }
    },
    [handlers]
  );

  const handleTouchMove = useCallback((event: TouchEvent) => {
    // Clear tap-hold timeout if moved
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }

    // Handle pinch
    if (
      event.touches.length === 2 &&
      touchStartRef.current &&
      touchStartRef2.current
    ) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      if (touch1 && touch2) {
        const startDist = Math.hypot(
          touchStartRef2.current.x - touchStartRef.current.x,
          touchStartRef2.current.y - touchStartRef.current.y
        );

        const currentDist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        if (startDist > 0) {
          const scale = currentDist / startDist;
          if (Math.abs(scale - 1) > 0.1) {
            // Only trigger if scale change > 10%
            handlers.onPinch?.(scale);
          }
        }
      }
    }
  }, [handlers]);

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      // Clear tap-hold timeout
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (!touchStartRef.current) return;

      const touch =
        event.changedTouches.length > 0 ? event.changedTouches[0] : null;
      if (!touch) {
        touchStartRef.current = null;
        touchStartRef2.current = null;
        return;
      }

      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.timestamp;

      // Detect swipe
      if (dt < SWIPE_TIME_THRESHOLD) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
          if (dx > 0) {
            handlers.onSwipeRight?.();
          } else {
            handlers.onSwipeLeft?.();
          }
        } else if (absDy > SWIPE_THRESHOLD && absDy > absDx) {
          if (dy > 0) {
            handlers.onSwipeDown?.();
          } else {
            handlers.onSwipeUp?.();
          }
        }
      }

      // Detect double-tap
      const now = Date.now();
      if (now - lastTapRef.current < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        handlers.onDoubleTap?.();
      }
      lastTapRef.current = now;

      touchStartRef.current = null;
      touchStartRef2.current = null;
    },
    [handlers]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    element.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [ref, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
