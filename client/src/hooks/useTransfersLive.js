// client/src/hooks/useTransfersLive.js
import { useEffect, useRef, useState } from "react";
import { listTransfers } from "../services/transfers.service";

export function useTransfersLive({ examId, intervalMs = 4000 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(examId));
  const [error, setError] = useState("");

  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!examId) {
      setItems([]);
      setLoading(false);
      setError("");
      firstLoadRef.current = true;
      return;
    }

    let alive = true;

    async function load({ silent = false } = {}) {
      try {
        if (!silent) setLoading(true);
        const data = await listTransfers(examId);
        if (!alive) return;

        setItems(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load transfers");
      } finally {
        if (!alive) return;
        if (!silent) setLoading(false);
      }
    }

    // first load = show loading
    load({ silent: false }).finally(() => {
      firstLoadRef.current = false;
    });

    // interval = silent refresh (no flicker)
    const t = setInterval(() => load({ silent: true }), intervalMs);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [examId, intervalMs]);

  return { items, loading, error };
}
