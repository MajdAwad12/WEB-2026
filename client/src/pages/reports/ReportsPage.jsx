// client/src/pages/reports/ReportsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import RocketLoader from "../../components/loading/RocketLoader.jsx";
import {
  getReportsList,
  getReportsAnalytics,
  getReportDetails,
  downloadReportPdf,
  downloadReportCsv,
} from "../../services/reports.service.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

/* =========================
   Small helpers
========================= */
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDateShort(d) {
  const s = String(d || "");
  if (!s) return "-";
  return s.includes("T") ? s.split("T")[0] : s;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function Kpi({ title, value, hint, tone = "slate" }) {
  const tones = {
    slate: "bg-white border-slate-200",
    sky: "bg-sky-50 border-sky-100 text-sky-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
    amber: "bg-amber-50 border-amber-100 text-amber-900",
    rose: "bg-rose-50 border-rose-100 text-rose-900",
    violet: "bg-violet-50 border-violet-100 text-violet-900",
  };
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${tones[tone]}`}>
      <p className="text-[11px] text-slate-500 font-semibold">{title}</p>
      <p className="text-2xl font-extrabold mt-1">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

function Card({ title, subtitle, right, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h4 className="text-lg font-bold mb-1">{title}</h4>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="text-xs text-slate-500">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // fetch list + analytics in parallel
        const [listData, analyticsData] = await Promise.all([getReportsList(), getReportsAnalytics()]);

        if (!alive) return;

        const exams = Array.isArray(listData?.exams) ? listData.exams : [];

        // keep consistent order for UI lists
        const sorted = [...exams].sort((a, b) => {
          const da = new Date(a?.date || 0).getTime();
          const db = new Date(b?.date || 0).getTime();
          return da - db;
        });

        setAll(sorted);
        setAnalytics(analyticsData || null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load reports");
        setAll([]);
        setAnalytics(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => {
      return (
        String(e.courseName || "").toLowerCase().includes(q) ||
        String(e.date || "").toLowerCase().includes(q) ||
        String((e.rooms || []).join(",")).toLowerCase().includes(q)
      );
    });
  }, [all, search]);

  const selected = useMemo(() => {
    return filtered.find((x) => String(x.examId) === String(selectedExamId)) || null;
  }, [filtered, selectedExamId]);

  async function loadDetails(examId) {
    try {
      setDetailsLoading(true);
      setDetails(null);
      setErr("");
      const d = await getReportDetails(examId);
      setDetails(d);
    } catch (e) {
      setErr(e?.message || "Failed to load report details");
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedExamId) {
      setDetails(null);
      return;
    }
    loadDetails(selectedExamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  /* =========================
     KPI Aggregates (from analytics + list)
  ========================= */
  const kpiAgg = useMemo(() => {
    const n = filtered.length || 1;
    const totalStudents = filtered.reduce((acc, x) => acc + toNum(x.totalStudents, 0), 0);
    const avgAttendanceRateFromList = filtered.reduce((acc, x) => acc + toNum(x.attendanceRate, 0), 0) / n;

    const a = analytics?.kpis || {};
    return {
      endedExams: toNum(a.endedExams, filtered.length),
      avgAttendanceRate: Number.isFinite(a.avgAttendanceRate) ? a.avgAttendanceRate : Math.round(avgAttendanceRateFromList * 10) / 10,
      totalCheating: toNum(a.totalCheatingIncidents, 0),
      totalToilet: toNum(a.totalToiletExits, 0),
      totalTeacherCalls: toNum(a.totalTeacherCalls, 0),
      totalStudents,
    };
  }, [analytics, filtered]);

  const examIdSet = useMemo(() => new Set(filtered.map((x) => String(x.examId))), [filtered]);

  /* =========================
     Chart 1: Attendance per exam (X: exams, Y: attended count)
     Using analytics.charts.attendanceSeries but filtered by search
  ========================= */
  const attendanceSeries = useMemo(() => {
    const raw = analytics?.charts?.attendanceSeries || [];
    const safe = raw.filter((x) => examIdSet.has(String(x.examId)));
    return safe;
  }, [analytics, examIdSet]);

  const attendanceChartData = useMemo(() => {
    const labels = attendanceSeries.map((x) => {
      const lab = String(x.label || "Exam");
      return lab.length > 22 ? `${lab.slice(0, 22)}…` : lab;
    });
    const attended = attendanceSeries.map((x) => toNum(x.attended, 0));
    const totals = attendanceSeries.map((x) => toNum(x.total, 0));

    return {
      labels,
      datasets: [
        {
          label: "Attended (count)",
          data: attended,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          pointBackgroundColor: "#2563eb",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          fill: true,
        },
        {
          label: "Total students",
          data: totals,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          borderColor: "rgba(15, 23, 42, 0.35)",
          backgroundColor: "rgba(15, 23, 42, 0.06)",
          fill: false,
        },
      ],
    };
  }, [attendanceSeries]);

  const attendanceOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { boxWidth: 10 } },
        tooltip: {
          intersect: false,
          mode: "index",
          callbacks: {
            label(ctx) {
              const v = ctx.parsed?.y;
              return `${ctx.dataset?.label}: ${v}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
        },
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false },
        },
      },
    };
  }, []);

  /* =========================
     Chart 2: Cheating incidents per supervisor (Bar)
  ========================= */
  const cheatingSeries = useMemo(() => {
    const raw = analytics?.charts?.cheatingSeries || [];
    return raw.slice(0, 12); // top 12 so it stays clean
  }, [analytics]);

  const cheatingChartData = useMemo(() => {
    const labels = cheatingSeries.map((x) => {
      const n = String(x.name || "Supervisor");
      return n.length > 16 ? `${n.slice(0, 16)}…` : n;
    });
    const data = cheatingSeries.map((x) => toNum(x.count, 0));

    return {
      labels,
      datasets: [
        {
          label: "Cheating / Copy incidents",
          data,
          borderRadius: 10,
          backgroundColor: "rgba(225, 29, 72, 0.20)",
          borderColor: "#e11d48",
          borderWidth: 2,
        },
      ],
    };
  }, [cheatingSeries]);

  const cheatingOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              return `Incidents: ${ctx.parsed?.y ?? 0}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
        },
        x: {
          grid: { display: false },
        },
      },
    };
  }, []);

  /* =========================
     Chart 3: Toilet exits per room (Bar)
  ========================= */
  const toiletSeries = useMemo(() => analytics?.charts?.toiletSeries || [], [analytics]);
  const toiletChartData = useMemo(() => {
    const labels = toiletSeries.map((x) => String(x.roomId || "UNKNOWN"));
    const data = toiletSeries.map((x) => toNum(x.count, 0));
    return {
      labels,
      datasets: [
        {
          label: "Toilet exits",
          data,
          borderRadius: 10,
          backgroundColor: "rgba(245, 158, 11, 0.22)",
          borderColor: "#f59e0b",
          borderWidth: 2,
        },
      ],
    };
  }, [toiletSeries]);

  const toiletOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
        },
        x: { grid: { display: false } },
      },
    };
  }, []);

  /* =========================
     Chart 4: Teacher calls per room (Bar)
  ========================= */
  const teacherSeries = useMemo(() => analytics?.charts?.teacherSeries || [], [analytics]);
  const teacherChartData = useMemo(() => {
    const labels = teacherSeries.map((x) => String(x.roomId || "UNKNOWN"));
    const data = teacherSeries.map((x) => toNum(x.count, 0));
    return {
      labels,
      datasets: [
        {
          label: "Teacher calls",
          data,
          borderRadius: 10,
          backgroundColor: "rgba(16, 185, 129, 0.20)",
          borderColor: "#10b981",
          borderWidth: 2,
        },
      ],
    };
  }, [teacherSeries]);

  const teacherOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
        },
        x: { grid: { display: false } },
      },
    };
  }, []);

  async function onDownloadPdf() {
    if (!selected) return;
    try {
      setDownloadBusy(true);
      setErr("");
      const safe = String(selected.courseName || "Exam").replace(/[^\w]+/g, "_");
      await downloadReportPdf(selected.examId, `Report_${safe}_${fmtDateShort(selected.date)}.pdf`);
    } catch (e) {
      setErr(e?.message || "PDF download failed");
    } finally {
      setDownloadBusy(false);
    }
  }

  async function onDownloadCsv() {
    if (!selected) return;
    try {
      setDownloadBusy(true);
      setErr("");
      const safe = String(selected.courseName || "Exam").replace(/[^\w]+/g, "_");
      await downloadReportCsv(selected.examId, `Report_${safe}_${fmtDateShort(selected.date)}.csv`);
    } catch (e) {
      setErr(e?.message || "CSV download failed");
    } finally {
      setDownloadBusy(false);
    }
  }

 if (loading) {
  return <RocketLoader />;
}

  const points = clamp(filtered.length, 0, 500);

  return (
    <section className="p-10 space-y-8 bg-slate-50 min-h-full">
      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">Reports & History</h2>
          <p className="text-sm text-slate-600 max-w-3xl mt-1">
            Ended exams analytics with realistic trends: attendance, cheating, toilet exits, and teacher calls.
          </p>
        </div>
      </div>

      {/* Errors */}
      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 p-4">
          <div className="font-bold text-sm">Error</div>
          <div className="text-sm mt-1">{err}</div>
        </div>
      ) : null}

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Kpi title="Ended exams" value={kpiAgg.endedExams} tone="sky" hint="Analytics across ended exams." />
        <Kpi title="Avg attendance rate" value={`${kpiAgg.avgAttendanceRate}%`} tone="emerald" hint="Finished counts as attended." />
        <Kpi title="Cheating incidents" value={kpiAgg.totalCheating} tone="rose" hint="Cheating / copy / phone / suspicious." />
        <Kpi title="Toilet exits" value={kpiAgg.totalToilet} tone="amber" hint="Requests to leave the room." />
        <Kpi title="Teacher calls" value={kpiAgg.totalTeacherCalls} tone="violet" hint="Often indicates difficulty/clarifications." />
      </section>

      {/* Charts (4) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Attendance per Exam"
          subtitle="X: ended exams • Y: attended count (present + finished + temp_out + moving depending on server rule)"
          right={`Points: ${points}`}
        >
          <div className="h-72">
            <Line data={attendanceChartData} options={attendanceOptions} />
          </div>
        </Card>

        <Card
          title="Cheating per Supervisor"
          subtitle="X: supervisors • Y: cheating/copy/phone incidents (top supervisors)"
          right={`Shown: ${cheatingSeries.length}`}
        >
          <div className="h-72">
            <Bar data={cheatingChartData} options={cheatingOptions} />
          </div>
        </Card>

        <Card
          title="Toilet Exits per Room"
          subtitle="X: rooms • Y: number of exits"
          right={`Rooms: ${toiletSeries.length}`}
        >
          <div className="h-72">
            <Bar data={toiletChartData} options={toiletOptions} />
          </div>
        </Card>

        <Card
          title="Teacher Calls per Room"
          subtitle="X: rooms • Y: number of calls"
          right={`Rooms: ${teacherSeries.length}`}
        >
          <div className="h-72">
            <Bar data={teacherChartData} options={teacherOptions} />
          </div>
        </Card>
      </section>

      {/* Controls */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-600">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by course name, date, or room…"
              className="mt-2 w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">Select exam</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="mt-2 w-full border rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Choose exam…</option>
              {filtered.map((r) => (
                <option key={r.examId} value={r.examId}>
                  {fmtDateShort(r.date)} • {r.courseName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onDownloadPdf}
              disabled={!selected || downloadBusy}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              ⬇ Download PDF
            </button>

            <button
              onClick={onDownloadCsv}
              disabled={!selected || downloadBusy}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              ⬇ Download Excel (CSV)
            </button>
          </div>

          <div className="text-xs text-slate-500">
            {selected ? (
              <span>
                Selected: <span className="font-bold text-slate-700">{selected.courseName}</span> • {fmtDateShort(selected.date)}
              </span>
            ) : (
              <span>Select an exam to see details and download.</span>
            )}
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold">Exam Details</h4>
          {detailsLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
        </div>

        {!selectedExamId ? (
          <p className="text-sm text-slate-600 mt-3">Pick an exam to see room breakdown and incidents.</p>
        ) : !details ? (
          <p className="text-sm text-slate-600 mt-3">No details loaded.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Room breakdown */}
            <div>
              <div className="flex items-end justify-between">
                <h5 className="font-bold text-slate-900">Room breakdown</h5>
                <div className="text-xs text-slate-500">Attendance rate by room (attended/total)</div>
              </div>

              <div className="overflow-x-auto mt-3">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Room</th>
                      <th className="px-3 py-2 text-left">Total</th>
                      <th className="px-3 py-2 text-left">Present</th>
                      <th className="px-3 py-2 text-left">Not arrived</th>
                      <th className="px-3 py-2 text-left">Temp out</th>
                      <th className="px-3 py-2 text-left">Absent</th>
                      <th className="px-3 py-2 text-left">Finished</th>
                      <th className="px-3 py-2 text-left">Incidents</th>
                      <th className="px-3 py-2 text-left">Violations</th>
                      <th className="px-3 py-2 text-left">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(details.roomStats || []).map((r) => (
                      <tr key={r.roomId}>
                        <td className="px-3 py-2 font-bold">{r.roomId}</td>
                        <td className="px-3 py-2">{r.total}</td>
                        <td className="px-3 py-2">{r.present}</td>
                        <td className="px-3 py-2">{r.not_arrived}</td>
                        <td className="px-3 py-2">{r.temp_out}</td>
                        <td className="px-3 py-2">{r.absent}</td>
                        <td className="px-3 py-2">{r.finished}</td>
                        <td className="px-3 py-2">{r.incidents}</td>
                        <td className="px-3 py-2">{r.violations}</td>
                        <td className="px-3 py-2 font-bold">{r.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Incidents */}
            <div>
              <h5 className="font-bold text-slate-900">Incidents timeline (Top)</h5>
              <p className="text-xs text-slate-500 mt-1">A realistic slice of events for the report.</p>

              <div className="mt-3 space-y-2">
                {(details.incidents || []).length === 0 ? (
                  <div className="text-sm text-slate-600">No incidents recorded.</div>
                ) : (
                  (details.incidents || []).map((x, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap gap-2 items-center justify-between">
                        <div className="text-xs font-bold text-slate-700">
                          {new Date(x.at).toISOString().replace("T", " ").slice(0, 16)}
                        </div>
                        <div className="text-xs text-slate-600">
                          {x.roomId || "-"} {x.seat ? `• ${x.seat}` : ""}
                        </div>
                      </div>
                      <div className="mt-1 font-bold text-sm text-slate-900">{x.type}</div>
                      <div className="text-sm text-slate-700 mt-1">{x.description}</div>
                      <div className="text-xs text-slate-500 mt-2">Severity: {x.severity}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            {details.notes ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-bold text-slate-600">Notes</div>
                <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{details.notes}</div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="text-xs text-slate-400">
        Tip: With the new seed, ended exams contain mixed statuses + rich events so analytics looks realistic.
      </div>
    </section>
  );
}
