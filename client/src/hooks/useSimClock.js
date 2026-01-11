// client/src/hooks/useSimClock.js
import { useEffect, useRef, useState } from "react";
import { getClock } from "../services/dashboard.service.js";

export function useSimClock() {
  const [simNow, setSimNow] = useState(null);
  const [simExamId, setSimExamId] = useState(null);

  const anchorsRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const data = await getClock();
        if (!alive) return;

        const simNowMs = new Date(data.simNow).getTime();
        anchorsRef.current = {
          simAnchorMs: simNowMs,
          realAnchorMs: Date.now(),
          speed: data.speed || 1,
        };

        setSimExamId(data.simExamId || null);
        setSimNow(new Date(simNowMs));
      } catch {
        // fallback to real clock
        const now = Date.now();
        anchorsRef.current = { simAnchorMs: now, realAnchorMs: now, speed: 1 };
        setSimExamId(null);
        setSimNow(new Date(now));
      }
    }

    init();

    const id = setInterval(() => {
      if (!anchorsRef.current) return;
      const { simAnchorMs, realAnchorMs, speed } = anchorsRef.current;
      const ms = simAnchorMs + (Date.now() - realAnchorMs) * (speed || 1);
      setSimNow(new Date(ms));
    }, 1000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const simNowMs = simNow ? simNow.getTime() : null;

  return { simNow, simNowMs, simExamId };
}
