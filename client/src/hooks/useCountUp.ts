import { useEffect, useRef, useState } from "react";

/**
 * Counts a number from 0 to `target` over `duration` ms using an
 * ease-out cubic curve. Returns the current animated value.
 *
 * @param target   The final numeric value to count to.
 * @param duration Animation duration in milliseconds (default 900ms).
 * @param enabled  Set to false to skip animation (e.g. while data is loading).
 */
export function useCountUp(
  target: number,
  duration = 900,
  enabled = true
): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || target === 0) {
      setCurrent(target);
      return;
    }

    // If target changed, restart from the previous displayed value
    const from = prevTargetRef.current;
    prevTargetRef.current = target;
    startTimeRef.current = null;

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setCurrent(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return current;
}
