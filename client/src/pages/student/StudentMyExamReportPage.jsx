// client/src/pages/student/StudentMyExamReportPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listMyEndedExams, getMyExamReport } from "../../services/student.service.js";
import RocketLoader from "../../components/loading/RocketLoader.jsx";

function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  const cls = map[tone] || map.slate;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

function fmt(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function msToMin(ms) {
  const x = Number(ms || 0);
  const mins = Math.round(x / 60000);
  return `${mins} min`;
}

function severityTone(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "critical") return "red";
  if (s === "high") return "amber";
  if (s === "medium") return "blue";
  return "slate";
}

export default function StudentMyExamReportPage() {
  const [loadingList, setLoadingList] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [err, setErr] = useState("");

  const [exams, setExams] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingList(true);
        setErr("");
        const data = await listMyEndedExams();
        if (!alive) return;
        const list = data?.exams || [];
        setExams(list);
        setSelectedId(list?.[0]?.id || "");
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load exams");
      } finally {
        if (!alive) return;
        setLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoadingReport(true);
        setErr("");
        const data = await getMyExamReport(selectedId);
        if (!alive) return;
        setReport(data);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "Failed to load report");
        setReport(null);
      } finally {
        if (!alive) return;
        setLoadingReport(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const me = report?.me || null;
  const exam = report?.exam || null;

  const scoreTone = useMemo(() => {
    const s = me?.score;
    if (typeof s !== "number") return "slate";
    if (s >= 90) return "green";
    if (s >= 75) return "blue";
    if (s >= 60) return "amber";
    return "red";
  }, [me?.score]);

  const statusTone = useMemo(() => {
    const s = String(me?.status || "");
    if (s === "finished") return "green";
    if (s === "present") return "blue";
    if (s === "temp_out") return "amber";
    if (s === "absent") return "red";
    return "slate";
  }, [me?.status]);

  const loading = loadingList || loadingReport;

  if (loading) {
    return <RocketLoader />;
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">STUDENT VIEW</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Exam Report</h1>
          <p className="mt-1 text-sm text-slate-600">Choose an ended exam and view your personal summary (read-only).</p>
        </div>

        <div className="w-full sm:w-[420px]">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Select ended exam</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loadingList || exams.length === 0}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-300"
          >
            {loadingList && <option>Loading…</option>}
            {!loadingList && exams.length === 0 && <option>No ended exams found</option>}
            {!loadingList &&
              exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.courseName} — {new Date(x.examDate || Date.now()).toLocaleDateString()}
                </option>
              ))}
          </select>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>
      ) : null}

      {!report || !exam || !me ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No report available.
        </div>
      ) : (
        <div className="space-y-4">
          {/* HERO CARD */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900">{exam.courseName}</h2>
                  <Badge tone="violet">{new Date(exam.examDate || Date.now()).toLocaleDateString()}</Badge>
                  <Badge tone={statusTone}>{String(me.status || "—").replaceAll("_", " ")}</Badge>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold text-slate-900">Room:</span> {me.roomId || "—"}{" "}
                    <span className="ml-2 font-semibold text-slate-900">Seat:</span> {me.seat || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Lecturer:</span> {exam?.lecturer?.name || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Arrived:</span> {fmt(me.arrivedAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Finished:</span> {fmt(me.finishedAt)}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:min-w-[240px]">
                <div className="text-xs font-semibold text-slate-500">FINAL SCORE</div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="text-4xl font-black tracking-tight text-slate-900">
                    {typeof me.score === "number" ? me.score : "—"}
                  </div>
                  <Badge tone={scoreTone}>{typeof me.score === "number" ? "graded" : "not graded"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-900">{me.toiletCount ?? 0}</div>
                    <div>Toilet exits</div>
                  </div>
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-900">{msToMin(me.totalToiletMs)}</div>
                    <div>Total time</div>
                  </div>
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-900">{me.incidentCount ?? 0}</div>
                    <div>Incidents</div>
                  </div>
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-900">{me.violations ?? 0}</div>
                    <div>Violations</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GRID: Timeline + Details */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Personal timeline */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold tracking-wide text-slate-900">PERSONAL TIMELINE</h3>
                <Badge>read-only</Badge>
              </div>

              {Array.isArray(report.timeline) && report.timeline.length ? (
                <div className="space-y-3">
                  {report.timeline.map((t, idx) => (
                    <div key={idx} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-slate-900">{t.kind || "event"}</div>
                        <Badge tone={severityTone(t.severity)}>{t.severity}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{fmt(t.at)}</div>
                      <div className="mt-2 text-sm text-slate-700">{t.note || "—"}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t.classroom ? `Room: ${t.classroom}` : ""} {t.seat ? ` • Seat: ${t.seat}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  No personal timeline records.
                </div>
              )}
            </div>

            {/* Notes + Transfers */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-extrabold tracking-wide text-slate-900">NOTES</h3>
                <div className="mt-3 space-y-2">
                  {(me.notes || []).length ? (
                    me.notes.map((n, i) => (
                      <div key={i} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-slate-200">
                        {n}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      No notes were recorded.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-extrabold tracking-wide text-slate-900">TRANSFERS</h3>
                <div className="mt-3 space-y-2">
                  {Array.isArray(report.transfers) && report.transfers.length ? (
                    report.transfers.map((tr, i) => (
                      <div key={i} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-bold text-slate-900">
                            {tr.from || "—"} → {tr.to || "—"}
                          </div>
                          <div className="text-xs text-slate-600">{fmt(tr.at)}</div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">{tr.reason || "—"}</div>
                        <div className="mt-2 text-xs text-slate-500">Approved by: {tr.approvedBy || "—"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      No transfers recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Incidents + Messages */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-extrabold tracking-wide text-slate-900">INCIDENTS / EVENTS</h3>
              <div className="mt-3 space-y-2">
                {Array.isArray(report.events) && report.events.length ? (
                  report.events.map((ev, i) => (
                    <div key={i} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-slate-900">{ev.type}</div>
                        <Badge tone={severityTone(ev.severity)}>{ev.severity}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{fmt(ev.at)}</div>
                      <div className="mt-2 text-sm text-slate-700">{ev.description || "—"}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {ev.classroom ? `Room: ${ev.classroom}` : ""} {ev.seat ? ` • Seat: ${ev.seat}` : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                    No incidents recorded.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-extrabold tracking-wide text-slate-900">MESSAGES (Exam Chat)</h3>
              <div className="mt-3 space-y-2">
                {Array.isArray(report.messages) && report.messages.length ? (
                  report.messages.map((m, i) => (
                    <div key={i} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-700">
                          {m.from?.name || "Unknown"}{" "}
                          <span className="text-slate-400">({m.from?.role || "—"})</span>
                        </div>
                        <div className="text-xs text-slate-500">{fmt(m.at)}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-800">{m.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                    No messages found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
