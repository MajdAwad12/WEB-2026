// client/src/hooks/useDashboardLive.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDashboardSnapshot } from "../services/dashboard.service";

function normalizeRoomId(v) {
  return String(v || "").trim();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function useDashboardLive({ roomId, pollMs = 6000 } = {}) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ keep latest roomId without restarting polling
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // ✅ keep latest pollMs without restarting polling
  const pollMsRef = useRef(pollMs);
  useEffect(() => {
    pollMsRef.current = pollMs;
  }, [pollMs]);

  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);
  const reqIdRef = useRef(0);

  const timerRef = useRef(null);

  // backoff on errors (prevents spam + improves UX)
  const backoffRef = useRef(1); // 1x, 2x, 4x...
  const MAX_BACKOFF = 6; // up to 6x

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const shouldPause = useCallback(() => {
    // Pause polling when tab is hidden to avoid unnecessary network & CPU
    return typeof document !== "undefined" && document.hidden;
  }, []);

  const scheduleNext = useCallback(
    (multiplier = 1) => {
      clearTimer();
      const base = Number(pollMsRef.current) || 6000;
      const wait = clamp(base * multiplier, 1500, 60000);
      timerRef.current = setTimeout(() => {
        tickRef.current?.();
      }, wait);
    },
    [clearTimer]
  );

  const fetchOnce = useCallback(async (opts = { force: false }) => {
    if (!aliveRef.current) return;
    if (shouldPause() && !opts.force) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const myReqId = ++reqIdRef.current;

    try {
      setError("");

      const snap = await getDashboardSnapshot(); // server decides visibility by role

      if (!aliveRef.current) return;
      if (myReqId !== reqIdRef.current) return;

      setRaw(snap);
      setLoading(false);

      // ✅ success => reset backoff
      backoffRef.current = 1;
    } catch (e) {
      if (!aliveRef.current) return;
      if (myReqId !== reqIdRef.current) return;

      setError(e?.message || "Failed to load dashboard");
      setLoading(false);

      // ✅ error => increase backoff (up to MAX_BACKOFF)
      backoffRef.current = clamp(backoffRef.current * 2, 1, MAX_BACKOFF);
    } finally {
      inFlightRef.current = false;
    }
  }, [shouldPause]);

  // we keep a stable "tick" ref so scheduleNext can call it
  const tickRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    reqIdRef.current += 1;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || !aliveRef.current) return;

      // if tab hidden => re-schedule (don’t fetch)
      if (shouldPause()) {
        scheduleNext(1);
        return;
      }

      await fetchOnce();
      if (cancelled || !aliveRef.current) return;

      // schedule using current backoff
      scheduleNext(backoffRef.current);
    };

    tickRef.current = tick;

    // start immediately
    tick();

    // also: when tab becomes visible, fetch immediately
    const onVis = () => {
      if (!aliveRef.current) return;
      if (!document.hidden) {
        backoffRef.current = 1;
        fetchOnce({ force: true });
        scheduleNext(1);
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      aliveRef.current = false;
      document.removeEventListener("visibilitychange", onVis);
      clearTimer();
    };
  }, [fetchOnce, clearTimer, scheduleNext, shouldPause]);

  const derived = useMemo(() => {
    const me = raw?.me || null;
    const exam = raw?.exam || null;
    const classrooms = exam?.classrooms || exam?.rooms || [];

    const rooms = (Array.isArray(classrooms) ? classrooms : [])
      .map((c) => ({
        id: normalizeRoomId(c?.id || c?.roomId || c?.name || c),
        name: normalizeRoomId(c?.name || c?.id || c?.roomId || c),
        rows: Number(c?.rows || 0),
        cols: Number(c?.cols || 0),
      }))
      .filter((r) => r.id);

    const firstRoomId = normalizeRoomId(rooms?.[0]?.id || rooms?.[0]?.name || "");
    const requestedRoomId = normalizeRoomId(roomIdRef.current);

    const effectiveRoomId =
      requestedRoomId ||
      normalizeRoomId(me?.assignedRoomId) ||
      firstRoomId ||
      "";

    const activeRoom = effectiveRoomId
      ? rooms.find((r) => normalizeRoomId(r.id) === normalizeRoomId(effectiveRoomId)) || null
      : rooms[0] || null;

    const attendance = raw?.attendance || exam?.attendance || [];

    return {
      me,
      exam,
      rooms,
      activeRoom,
      attendance,
      transfers: raw?.transfers || [],
      stats: raw?.stats || {},
      alerts: raw?.alerts || [],
      inbox: raw?.inbox || { unread: 0, recent: [] },
      events: raw?.events || [],
    };
  }, [raw]);

  // ✅ manual refetch (instant + reset backoff)
  const refetch = useCallback(async () => {
    backoffRef.current = 1;
    await fetchOnce({ force: true });
    scheduleNext(1);
  }, [fetchOnce, scheduleNext]);

  return { ...derived, raw, loading, error, refetch };
}
