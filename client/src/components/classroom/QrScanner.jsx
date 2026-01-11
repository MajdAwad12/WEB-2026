// client/src/components/classroom/QrScanner.jsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Real QR scanner component (camera) - stable in DEV StrictMode.
 *
 * Props:
 * - open: boolean
 * - onResult: (text: string) => void
 * - onError: (msg: string) => void
 * - fps?: number
 * - qrbox?: number
 * - facingMode?: "environment" | "user"
 */
export default function QrScanner({
  open,
  onResult,
  onError,
  fps = 10,
  qrbox = 240,
  facingMode = "environment",
}) {
  const regionIdRef = useRef(`qr-region-${Math.random().toString(16).slice(2)}`);

  // Html5Qrcode instance
  const scannerRef = useRef(null);

  // running flag
  const runningRef = useRef(false);

  // start/stop mutex to avoid races
  const opRef = useRef(Promise.resolve());

  // DEV StrictMode guard: defer start slightly so first mount cleanup cancels it
  const startTimerRef = useRef(null);

  // de-dup results
  const lastTextRef = useRef("");
  const lastTimeRef = useRef(0);

  const [starting, setStarting] = useState(false);

  function isSecureContextOk() {
    // camera requires secure context (https) except localhost/127.0.0.1
    if (window.isSecureContext) return true;
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }

  function clearStartTimer() {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }

  async function safeStop() {
    clearStartTimer();

    // serialize stop with mutex
    opRef.current = opRef.current.then(async () => {
      const s = scannerRef.current;
      if (!s) return;

      // If not running, still try clear to release video element
      try {
        if (runningRef.current) {
          try {
            await s.stop();
          } catch {}
        }
      } finally {
        try {
          await s.clear();
        } catch {}
        scannerRef.current = null;
        runningRef.current = false;
      }
    });

    return opRef.current;
  }

  async function safeStart() {
    // serialize start with mutex
    opRef.current = opRef.current.then(async () => {
      if (!open) return; // open might have flipped while waiting

      if (scannerRef.current || runningRef.current) return;

      if (!isSecureContextOk()) {
        onError?.("Camera requires HTTPS (or http://localhost). Your page is not a secure origin.");
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        onError?.("Camera is not supported on this browser/device.");
        return;
      }

      setStarting(true);

      const regionId = regionIdRef.current;

      // IMPORTANT: ensure the DOM node exists
      const el = document.getElementById(regionId);
      if (!el) {
        setStarting(false);
        return;
      }

      const s = new Html5Qrcode(regionId);
      scannerRef.current = s;

      try {
        await s.start(
          { facingMode },
          {
            fps,
            qrbox: { width: qrbox, height: qrbox },
            aspectRatio: 1.0,
            disableFlip: true,
          },
          (decodedText) => {
            const t = String(decodedText || "").trim();
            if (!t) return;

            const now = Date.now();
            if (t === lastTextRef.current && now - lastTimeRef.current < 1200) return;

            lastTextRef.current = t;
            lastTimeRef.current = now;

            onResult?.(t);
          },
          () => {}
        );

        runningRef.current = true;
      } catch (e) {
        // Cleanly release if start failed
        try {
          await s.stop();
        } catch {}
        try {
          await s.clear();
        } catch {}
        scannerRef.current = null;
        runningRef.current = false;

        onError?.(
          "Camera failed. Make sure: (1) HTTPS or localhost, (2) allow camera permission in the browser, (3) Windows camera privacy is enabled."
        );
      } finally {
        setStarting(false);
      }
    });

    return opRef.current;
  }

  useEffect(() => {
    // When open becomes true: defer start slightly (fix DEV StrictMode flash-open-close)
    // When open becomes false: stop immediately.
    if (open) {
      clearStartTimer();
      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        safeStart();
      }, 120);
    } else {
      safeStop();
    }

    // On unmount: stop (and cancel any scheduled start)
    return () => {
      safeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fps, qrbox, facingMode]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-extrabold text-slate-900">Camera QR Scanner</div>
        {starting ? <div className="text-xs text-slate-600 font-bold">Starting…</div> : null}
      </div>

      <div
        id={regionIdRef.current}
        className="w-full rounded-2xl bg-black overflow-hidden"
        style={{ minHeight: 260 }}
      />

      <div className="mt-2 text-xs text-slate-600">
        Tip: Use HTTPS/localhost • Allow camera permission • Prefer back camera (“environment”).
      </div>
    </div>
  );
}
