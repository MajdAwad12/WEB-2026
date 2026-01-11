// ===============================
// file: client/src/pages/exams/ExamsPage.jsx
// ===============================
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import RocketLoader from "../../components/loading/RocketLoader.jsx";
import { getExams } from "../../services/exams.service.js";

const TABS = [
  { key: "all", label: "All" },
  { key: "past", label: "Past" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
];

function classify(exam) {
  const now = Date.now();
  const start = new Date(exam?.startAt).getTime();
  const end = new Date(exam?.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unknown";
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "past";
}

function fmtParts(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return { date: "--", time: "--" };
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function getRooms(ex) {
  const rooms = Array.isArray(ex?.classrooms) ? ex.classrooms : [];
  return rooms.map((c) => c?.name || c?.id).filter(Boolean);
}

function getSupervisors(ex) {
  return (Array.isArray(ex?.supervisors) ? ex.supervisors : [])
    .map((s) => String(s?.name || "").trim())
    .filter(Boolean);
}

function studentsCount(ex) {
  return Number(ex?.report?.summary?.totalStudents) || Number(ex?.attendance?.length) || 0;
}

function StatusPill({ v }) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border";
  const cls =
    v === "live"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : v === "upcoming"
      ? "bg-sky-50 border-sky-200 text-sky-800"
      : v === "past"
      ? "bg-slate-100 border-slate-200 text-slate-700"
      : "bg-amber-50 border-amber-200 text-amber-900";
  return <span className={`${base} ${cls}`}>{String(v || "").toUpperCase()}</span>;
}

export default function ExamsPage() {
  const { setChatContext } = useOutletContext();

  const [tab, setTab] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ Update bot context for Exams List page
  useEffect(() => {
    if (!setChatContext) return;
    setChatContext((prev) => ({
      ...prev,
      screen: "exams_list",
      examId: null,
      roomId: null,
      stats: null,
      alertsCount: 0,
      transfersCount: 0,
    }));
  }, [setChatContext]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        // ✅ FIX: use service (respects VITE_API_BASE and production)
        const data = await getExams();
        const list = Array.isArray(data?.exams) ? data.exams : [];
        if (alive) setItems(list);
      } catch (e) {
        if (alive) setError(e?.message || "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((ex) => classify(ex) === tab);
  }, [items, tab]);

  if (loading) {
    return <RocketLoader />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900 shadow-sm">
          <div className="font-extrabold text-lg">Failed to load exams</div>
          <div className="text-sm mt-1">{error}</div>
          <div className="text-xs mt-2 text-rose-800/80">
            Tip: make sure you are logged-in (cookie "sid" exists), then refresh.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Exam List</h1>
          <div className="text-sm text-slate-600 mt-1">Clean view. No horizontal scroll. Supervisors shown vertically.</div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-extrabold transition ${
                tab === t.key ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2.2fr_0.9fr_1.1fr_1.1fr_1.2fr_1.6fr_1.1fr_0.5fr] gap-0 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[12px] font-extrabold text-slate-600">
          <div>Course</div>
          <div>Status</div>
          <div>Start</div>
          <div>End</div>
          <div>Lecturer</div>
          <div>Supervisors</div>
          <div>Rooms</div>
          <div className="text-right">Students</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((ex) => {
            const st = classify(ex);
            const start = fmtParts(ex?.startAt);
            const end = fmtParts(ex?.endAt);

            const rooms = getRooms(ex);
            const roomsShown = rooms.slice(0, 3);
            const roomsMore = Math.max(0, rooms.length - roomsShown.length);

            const sups = getSupervisors(ex);
            const cnt = studentsCount(ex);

            return (
              <div key={String(ex?.id || ex?._id)} className="px-5 py-4 hover:bg-slate-50/60 transition">
                <div className="hidden lg:grid grid-cols-[2.2fr_0.9fr_1.1fr_1.1fr_1.2fr_1.6fr_1.1fr_0.5fr] gap-6 items-start">
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-[15px] leading-snug break-words">{ex?.courseName || "-"}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      ID: <span className="font-semibold">{String(ex?.id || ex?._id || "-")}</span>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <StatusPill v={st} />
                  </div>

                  <div className="text-slate-800">
                    <div className="font-bold">{start.date}</div>
                    <div className="text-xs text-slate-500">{start.time}</div>
                  </div>

                  <div className="text-slate-800">
                    <div className="font-bold">{end.date}</div>
                    <div className="text-xs text-slate-500">{end.time}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 break-words">{ex?.lecturer?.name || "-"}</div>
                  </div>

                  <div className="min-w-0">
                    {sups.length ? (
                      <ul className="space-y-1">
                        {sups.slice(0, 4).map((n, i) => (
                          <li key={i} className="text-slate-800 text-sm leading-snug break-words">
                            <span className="text-slate-400 mr-1">•</span>
                            {n}
                          </li>
                        ))}
                        {sups.length > 4 ? <li className="text-xs text-slate-500 font-bold">+{sups.length - 4} more</li> : null}
                      </ul>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    {roomsShown.length ? (
                      <div className="text-sm text-slate-800 leading-snug break-words">
                        {roomsShown.join(", ")}
                        {roomsMore ? <span className="text-xs text-slate-500 font-bold"> +{roomsMore} more</span> : null}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>

                  <div className="text-right text-slate-800 font-semibold whitespace-nowrap">{cnt}</div>
                </div>

                {/* Mobile */}
                <div className="lg:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 text-[15px] leading-snug break-words">{ex?.courseName || "-"}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID: <span className="font-semibold">{String(ex?.id || ex?._id || "-")}</span>
                      </div>
                    </div>
                    <StatusPill v={st} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-extrabold text-slate-500">Start</div>
                      <div className="font-bold text-slate-900">{start.date}</div>
                      <div className="text-xs text-slate-500">{start.time}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-extrabold text-slate-500">End</div>
                      <div className="font-bold text-slate-900">{end.date}</div>
                      <div className="text-xs text-slate-500">{end.time}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 col-span-2">
                      <div className="text-[11px] font-extrabold text-slate-500">Lecturer</div>
                      <div className="font-semibold text-slate-900 break-words">{ex?.lecturer?.name || "-"}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 col-span-2">
                      <div className="text-[11px] font-extrabold text-slate-500">Supervisors</div>
                      {sups.length ? (
                        <ul className="mt-1 space-y-1">
                          {sups.map((n, i) => (
                            <li key={i} className="text-sm text-slate-800 leading-snug break-words">
                              <span className="text-slate-400 mr-1">•</span>
                              {n}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-slate-400">-</div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 col-span-2">
                      <div className="text-[11px] font-extrabold text-slate-500">Rooms</div>
                      <div className="text-sm text-slate-800 break-words">{rooms.length ? rooms.join(", ") : "-"}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 col-span-2 flex items-center justify-between">
                      <div className="text-[11px] font-extrabold text-slate-500">Students</div>
                      <div className="px-3 py-1 rounded-xl bg-slate-900 text-white text-sm font-extrabold">{cnt}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && <div className="p-10 text-center text-slate-500">No exams in this filter.</div>}
        </div>
      </div>
    </div>
  );
}
