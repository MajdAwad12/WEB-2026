// client/src/components/dashboard/ExamOverviewCard.jsx

function fmtDateTime(d) {
  if (!d) return "--";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function msToHHMMSS(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function ExamOverviewCard({ me, exam, stats, simNow, loading }) {
  const role = me?.role || "";

  const startMs = exam?.startAt ? new Date(exam.startAt).getTime() : null;
  const endMs = exam?.endAt ? new Date(exam.endAt).getTime() : null;
  const nowMs = simNow ? simNow.getTime() : null;

  const hasTimes =
    Number.isFinite(startMs) && Number.isFinite(endMs) && Number.isFinite(nowMs);

  const remainingMs = hasTimes ? Math.max(0, endMs - nowMs) : null;

  const status = exam?.status || "scheduled";
  const live = status === "running";

  const endedByTime = hasTimes && nowMs >= endMs;
  const showEndsIn = live && remainingMs != null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-extrabold text-slate-900">Current Exam</h4>

            {live ? (
              <span className="flex items-center text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Live - Running Now
              </span>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-50 text-slate-700 font-semibold border border-slate-200">
                {status}
              </span>
            )}

            {endedByTime ? (
              <span className="text-[11px] px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-100">
                Time Ended
              </span>
            ) : null}
          </div>

         
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Sim Time</div>
          <div className="text-sm font-extrabold text-slate-900">
            {simNow ? fmtDateTime(simNow) : "--"}
          </div>

          {showEndsIn ? (
            <div className="mt-1 text-xs">
              <span className="text-slate-500">Ends in: </span>
              <span className="font-extrabold text-slate-900">{msToHHMMSS(remainingMs)}</span>
            </div>
          ) : endedByTime ? (
            <div className="mt-1 text-xs">
              <span className="text-slate-500">Ends in: </span>
              <span className="font-extrabold text-rose-700">00:00:00</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        {loading ? (
          <div className="text-sm text-slate-600">Loading exam...</div>
        ) : !exam ? (
          <div className="text-sm text-slate-700 bg-slate-50 rounded-2xl p-4 border border-slate-200">
            No running exam found right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Course:</span>{" "}
                {exam.courseName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Start:</span>{" "}
                {fmtDateTime(exam.startAt)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">End:</span>{" "}
                {fmtDateTime(exam.endAt)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Lecturer:</span>{" "}
                {exam.lecturer?.name || "--"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Supervisors:</span>{" "}
                {(exam.supervisors || [])
                  .map((s) => s?.name)
                  .filter(Boolean)
                  .join(", ") || "--"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <Kpi label="Not arrived" value={stats?.notArrived ?? 0} />
              <Kpi label="Present" value={stats?.present ?? 0} />
              <Kpi label="Temp out" value={stats?.tempOut ?? 0} />
              <Kpi label="Moving" value={stats?.moving ?? 0} />
              <Kpi label="Finished" value={stats?.finished ?? 0} />
              <Kpi label="Violations" value={stats?.violations ?? 0} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
