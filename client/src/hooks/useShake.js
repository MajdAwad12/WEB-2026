import { useCallback, useRef, useState } from "react";

/**
 * useShake(durationMs)
 * מחזיר:
 *  - shake (boolean) -> כדי להוסיף className "shake"
 *  - triggerShake() -> מפעיל shake
 */
export function useShake(durationMs = 500) {
  const [shake, setShake] = useState(false);
  const timerRef = useRef(null);

  const triggerShake = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // נוריד ואז נעלה כדי להפעיל מחדש אנימציה גם אם לוחצים מהר
    setShake(false);
    requestAnimationFrame(() => {
      setShake(true);
      timerRef.current = setTimeout(() => setShake(false), durationMs + 50);
    });
  }, [durationMs]);

  return { shake, triggerShake };
}
