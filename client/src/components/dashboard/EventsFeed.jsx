// client/src/components/dashboard/EventsFeed.jsx
import { useMemo, useState } from "react";

function fmtTime(d) {
  const dt = new Date(d || Date.now());
  if (Number.isNaN(dt.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(dt);
}

function sevMeta(sev) {
  const s = String(sev || "low").toLowerCase();
  if (s === "high" || s === "critical") {
    return { pill: "bg-rose-600 text-white", row: "border-rose-200 bg-rose-50", dot: "bg-rose-500" };
  }
  if (s === "medium") {
    return { pill: "bg-amber-500 text-white", row: "border-amber-200 bg-amber-50", dot: "bg-amber-500" };
  }
  return { pill: "bg-slate-200 text-slate-900", row: "border-slate-200 bg-slate-50", dot: "bg-slate-400" };
}

function titleOf(item) {
  const t = String(item?.type || item?.kind || item?.eventType || "EVENT").toUpperCase();
  if (t.includes("TOILET_LONG")) return "Toilet too long";
  if (t.includes("MESSAGE")) return "Message";
  if (t.includes("CALL_LECTURER")) return "Call lecturer";
  if (t.includes("VIOLATION")) return "Violation";
  if (t.includes("CHEAT")) return "Cheating note";
  if (t.includes("TRANSFER")) return "Transfer";
  if (t.includes("ALERT")) return "Alert";
  return t.replaceAll("_", " ");
}

function pickText(item) {
  // Try many common shapes to ensure alert content is displayed
  const candidates = [
    item?.text,
    item?.note,
    item?.message,
    item?.content,
    item?.description,
    item?.title,
    item?.details?.note,
    item?.details?.text,
    item?.details?.message,
    item?.payload?.note,
    item?.payload?.text,
    item?.payload?.message,
    item?.data?.note,
    item?.data?.text,
    item?.data?.message,
    item?.meta?.note,
    item?.meta?.text,
    item?.meta?.message,
  ];

  for (const c of candidates) {
    const s = typeof c === "string" ? c.trim() : "";
    if (s) return s;
  }
  return "";
}

function normalize(item, source) {
  const at = item?.at || item?.createdAt || item?.time || item?.timestamp || new Date().toISOString();
  const severity = item?.severity || item?.level || (source === "alert" ? "medium" : "low");
  const roomId = item?.roomId || item?.classroom || item?.room || "";
  const seat = item?.seat || item?.seatId || "";
  const studentCode = item?.studentCode || item?.studentNumber || item?.studentId || "";
  const name = item?.name || item?.student?.name || item?.studentName || "";

  const text = pickText(item);

  return { source, at, severity, roomId, seat, text, studentCode, name, raw: item };
}

export default function EventsFeed({ events = [], alerts = [], activeRoomId = "" }) {
  const [q, setQ] = useState("");
  const [onlyThisRoom, setOnlyThisRoom] = useState(false);

  const merged = useMemo(() => {
    const a = (Array.isArray(alerts) ? alerts : []).map((x) => normalize(x, "alert"));
    const e = (Array.isArray(events) ? events : []).map((x) => normalize(x, "event"));
    const all = [...a, ...e];
    all.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    return all.slice(0, 30);
  }, [alerts, events]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return merged.filter((it) => {
      if (onlyThisRoom && activeRoomId) {
        if (String(it.roomId) !== String(activeRoomId)) return false;
      }
      if (!query) return true;

      const head = titleOf(it.raw);
      const hay = `${head} ${it.text} ${it.roomId} ${it.seat} ${it.studentCode} ${it.name}`.toLowerCase();
      return hay.includes(query);
    });
  }, [merged, q, onlyThisRoom, activeRoomId]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Live monitoring</div>
            <div className="text-lg font-extrabold text-slate-900">Alerts & Events</div>
            <div className="mt-1 text-xs text-slate-500">
              Alerts highlighted • Search + room filter
            </div>
          </div>
          <div className="text-xs text-slate-500 font-bold">
            Showing <span className="text-slate-900">{filtered.length}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: toilet, message, seat, ID..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
          />

          <button
            type="button"
            onClick={() => setOnlyThisRoom((v) => !v)}
            disabled={!activeRoomId}
            className={`rounded-2xl border px-3 py-2 text-sm font-extrabold ${
              onlyThisRoom
                ? "bg-sky-600 border-sky-600 text-white"
                : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50"
            } disabled:opacity-50`}
            title={activeRoomId ? `Filter Room ${activeRoomId}` : "No active room"}
          >
            {onlyThisRoom ? `Filtered: Room ${activeRoomId}` : "Filter: This room"}
          </button>
        </div>
      </div>

      <div className="p-5 bg-slate-50">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No alerts/events.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((it, idx) => {
              const sev = sevMeta(it.severity);
              const head = titleOf(it.raw);

              const shownText = it.text?.trim()
                ? it.text
                : (it.source === "alert"
                    ? "Alert received (no details provided)."
                    : "—");

              return (
                <div
                  key={`${idx}-${String(it.at)}`}
                  className={`rounded-3xl border p-4 shadow-sm ${sev.row}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2.5 h-2.5 rounded-full ${sev.dot}`} />
                        <span className="text-xs font-extrabold text-slate-900">{head}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${sev.pill}`}>
                          {String(it.severity || "low").toUpperCase()}
                        </span>

                        {it.roomId ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white/70 text-slate-700 font-extrabold">
                            Room {it.roomId}
                          </span>
                        ) : null}
                        {it.seat ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white/70 text-slate-700 font-extrabold">
                            Seat {it.seat}
                          </span>
                        ) : null}
                        {it.studentCode ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white/70 text-slate-700 font-extrabold">
                            ID {it.studentCode}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 text-sm font-bold text-slate-900 break-words">
                        {shownText}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-extrabold text-slate-700">{fmtTime(it.at)}</div>
                      <div className="mt-1 text-[10px] text-slate-500 uppercase font-extrabold">
                        {it.source}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
