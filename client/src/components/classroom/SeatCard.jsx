// ===== file: client/src/components/classroom/SeatCard.jsx =====
import { msToMMSS, safeId, safeName, statusMeta, normalizeStatus } from "./utils";

function transferMeta(mode = "pending") {
  if (mode === "moving") {
    return {
      label: "Moving",
      seat: "bg-purple-500",
      card: "bg-purple-50 border-purple-200",
    };
  }
  return {
    label: "Pending transfer",
    seat: "bg-purple-500",
    card: "bg-purple-50 border-purple-200",
  };
}

function seatLabel(seat) {
  const s = String(seat || "").trim();
  if (!s) return "—";
  if (s.toUpperCase() === "AUTO") return "AUTO";
  return s;
}

function ChairIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M18 10c0-2.2 1.8-4 4-4h20c2.2 0 4 1.8 4 4v22H18V10z" fill="currentColor" opacity="0.25" />
      <path d="M14 32h36c2.2 0 4 1.8 4 4v10H10V36c0-2.2 1.8-4 4-4z" fill="currentColor" opacity="0.35" />
      <path d="M14 46h6v12h-6V46zm30 0h6v12h-6V46z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export default function SeatCard({ a, elapsedMs = 0, toiletCount = 0, onClick }) {
  const rawStatus = String(a?.status || "").toLowerCase();

  const isMoving = rawStatus === "moving";
  const isPending = Boolean(a?.transferPending);

  // ✅ purple if pending OR moving
  const meta = isMoving ? transferMeta("moving") : isPending ? transferMeta("pending") : statusMeta(a?.status);

  const statusUI = normalizeStatus(a?.status);

  const name = safeName(a) || "Student";
  const id = safeId(a);

  const showTimer = rawStatus === "temp_out";
  const seatTxt = seatLabel(a?.seat);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${name}${id ? ` (${id})` : ""} • Seat: ${seatTxt}`}
      className={[
        // ✅ keep card stable when Out timer appears
        "w-full h-full rounded-2xl border shadow-sm text-left px-3 py-2",
        "transition hover:shadow-md active:scale-[0.99]",
        "overflow-hidden", // ✅ prevent any text from escaping the card
        meta.card,
      ].join(" ")}
    >
      {/* ✅ Fixed-height inner layout (prevents pushing down / overflow) */}
      <div className="h-full flex flex-col min-h-0">
        {/* Top row: name + status dot */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold text-slate-900 truncate">{name}</div>
            <div className="text-[10px] text-slate-700/80 truncate">{id ? `ID: ${id}` : "—"}</div>
          </div>

          <span className={`w-3 h-3 rounded-full ${meta.seat}`} />
        </div>

        {/* Middle: chair + info */}
        <div className="mt-2 flex items-center justify-between gap-2 min-h-0">
          <div className="relative -mt-3 w-[56px] h-[44px] shrink-0">
            <ChairIcon className="w-full h-full text-slate-800" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="px-2 py-0.5 rounded-lg bg-white/80 border border-slate-200 text-[10px] font-extrabold text-slate-900">
                {seatTxt}
              </span>
            </div>
          </div>

          {/* ✅ right side locked to card width; no wrap; no push */}
          <div className="min-w-0 flex-1 text-right flex flex-col">
          <div className="text-[10px] font-extrabold text-slate-700 leading-tight whitespace-normal break-words">
            {meta.label}
          </div>

            {/* bottom badges area: always one line, doesn't resize height */}
            <div className="mt-auto pt-1 flex items-center justify-end gap-2 min-w-0">
              {Number(toiletCount) > 0 ? (
                <div className="text-[10px] font-extrabold text-amber-900 whitespace-nowrap">🚻 {Number(toiletCount)}</div>
              ) : null}

              {showTimer ? (
                <div className="text-[10px] font-extrabold text-amber-900 whitespace-nowrap">
                  ⏱ {msToMMSS(elapsedMs)}
                </div>
              ) : isPending ? (
                <div className="text-[10px] font-extrabold text-purple-900 whitespace-nowrap">pending</div>
              ) : isMoving ? (
                <div className="text-[10px] font-extrabold text-purple-900 whitespace-nowrap">moving</div>
              ) : statusUI === "waiting_transfer" ? (
                <div className="text-[10px] font-extrabold text-purple-900 whitespace-nowrap">waiting</div>
              ) : (
                // keep row height stable even when nothing to show
                <span className="text-[10px] opacity-0 select-none whitespace-nowrap">.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
