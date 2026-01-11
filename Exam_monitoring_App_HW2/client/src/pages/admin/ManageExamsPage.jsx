// ===============================
// file: client/src/pages/admin/ManageExamsPage.jsx
// ===============================
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";

import { createExam, getAdminExams, startExam, endExam } from "../../services/exams.service.js";
import { listUsers, updateExamAdmin, deleteExamAdmin, autoAssignDraft } from "../../services/admin.service.js";
import RocketLoader from "../../components/loading/RocketLoader.jsx";

/* =========================
   Utils
========================= */
function safeArr(x, fallback = []) {
  return Array.isArray(x) ? x : fallback;
}

function unwrapUsers(res) {
  if (Array.isArray(res)) return res;
  if (res?.users && Array.isArray(res.users)) return res.users;
  if (res?.data?.users && Array.isArray(res.data.users)) return res.data.users;
  return [];
}

function unwrapExams(res) {
  if (Array.isArray(res)) return res;
  if (res?.exams && Array.isArray(res.exams)) return res.exams;
  if (res?.data?.exams && Array.isArray(res.data.exams)) return res.data.exams;
  return [];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDT(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function fmtShort(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString();
}

function getId(x) {
  return x?._id || x?.id;
}

function statusBadge(status) {
  const s = String(status || "scheduled").toLowerCase();
  if (s === "running") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "ended") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "scheduled") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

function modeBadge(mode) {
  const m = String(mode || "onsite").toLowerCase();
  return m === "online" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const k = String(x || "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/* =========================
   Small UI primitives
========================= */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function SectionTitle({ title, desc }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-extrabold text-slate-900">{title}</div>
      {desc ? <div className="text-xs text-slate-600 mt-1">{desc}</div> : null}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Btn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, subtitle, onClose, children, footer, maxWidth = "max-w-xl", maxVh = 85 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bodyMax = Math.max(40, Math.min(72, maxVh - 25));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`w-full ${maxWidth} bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden`}
          style={{ maxHeight: `${maxVh}vh` }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-4 p-4 border-b border-slate-200">
            <div>
              <div className="text-lg font-extrabold text-slate-900">{title}</div>
              {subtitle ? <div className="text-sm text-slate-600 mt-1">{subtitle}</div> : null}
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 overflow-y-auto" style={{ maxHeight: `${bodyMax}vh` }}>
            {children}
          </div>

          {footer ? <div className="p-4 border-t border-slate-200 bg-slate-50">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Time window helpers (CLIENT)
========================= */
function examTimes(exam) {
  const startMs = new Date(exam?.startAt || exam?.examDate || 0).getTime();
  const endMs = new Date(exam?.endAt || 0).getTime();
  return { startMs, endMs };
}

function windowState(exam) {
  const { startMs, endMs } = examTimes(exam);
  const nowMs = Date.now();

  const valid = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > 0 && endMs > 0 && endMs > startMs;

  if (!valid) return { valid: false, active: false, future: false, past: false, nowMs };

  const active = nowMs >= startMs && nowMs <= endMs;
  const future = nowMs < startMs;
  const past = nowMs > endMs;

  return { valid: true, active, future, past, nowMs };
}

/* =========================
   Room helpers (stable keys)
========================= */
function buildRoomDraft(uid, id) {
  const cleanId = String(id || "").trim() || `Room-${uid}`;
  return {
    _uid: uid,
    id: cleanId,
    name: cleanId,
    rows: 5,
    cols: 5,
    assignedSupervisorId: "",
    assignedSupervisorName: "",
  };
}

/* =========================
   Page
========================= */
export default function ManageExamsPage() {
  const { me } = useOutletContext();

  const [lecturers, setLecturers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [exams, setExams] = useState([]);

  // ✅ Split loading:
  // - initialLoading: first fetch only (full page loader ok)
  // - refreshing: subsequent refreshes (do NOT block page)
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editExam, setEditExam] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const msgTimerRef = useRef(null);

  function showMsg(text, ms = 2500) {
    setMsg(text);
    if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => {
      setMsg(null);
      msgTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    return () => {
      if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    };
  }, []);

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setClockTick((x) => x + 1), 10000);
    return () => window.clearInterval(t);
  }, []);

  function openConfirm({ title, text, action }) {
    setConfirmTitle(title);
    setConfirmText(text);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  // Form state (shared create/edit)
  const [courseName, setCourseName] = useState("Introduction to Web Systems");
  const [examMode, setExamMode] = useState("onsite");
  const [startAt, setStartAt] = useState(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [endAt, setEndAt] = useState(toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [lecturerId, setLecturerId] = useState("");

  // ✅ stable room uid generator
  const roomUidRef = useRef(0);
  const nextRoomUid = () => {
    roomUidRef.current += 1;
    return roomUidRef.current;
  };

  // ✅ Rooms (Create starts from 0 rooms)
  const [rooms, setRooms] = useState(() => []);

  // ✅ Create-only: draft state
  const [totalStudentsDraft, setTotalStudentsDraft] = useState(0);
  const [requestedRoomsDraft, setRequestedRoomsDraft] = useState(0);

  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMeta, setDraftMeta] = useState(null);

  // ✅ lecturers draft assignment preview
  const [draftLecturer, setDraftLecturer] = useState(null);
  const [draftCoLecturers, setDraftCoLecturers] = useState([]);

  // Filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);

  // ✅ SAFE refresh that does not force full-page loader after initial load
  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      setError(null);

      try {
        const [lsRes, ssRes, exRes] = await Promise.all([listUsers("lecturer"), listUsers("supervisor"), getAdminExams()]);
        const ls = unwrapUsers(lsRes);
        const ss = unwrapUsers(ssRes);
        const list = unwrapExams(exRes);

        setLecturers(ls);
        setSupervisors(ss);
        setExams(list);

        // keep lecturer selection stable
        if (!lecturerId && ls.length) setLecturerId(String(getId(ls[0])));
      } catch (e) {
        setError(e?.message || "Failed to load admin data");
      } finally {
        if (silent) setRefreshing(false);
        else setInitialLoading(false);
      }
    },
    [lecturerId]
  );

  useEffect(() => {
    refresh({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ clean admin gate
  if (me?.role !== "admin") {
    if (initialLoading) return <RocketLoader />;
    return (
      <Card className="p-6">
        <div className="text-xl font-extrabold text-slate-900">Exam Management</div>
        <div className="mt-2 text-slate-600">
          This page is available for <span className="font-semibold">Admin</span> only.
        </div>
      </Card>
    );
  }

  function resetFormToDefaults() {
    setCourseName("Introduction to Web Systems");
    setExamMode("onsite");
    setStartAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setEndAt(toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));

    setTotalStudentsDraft(0);
    setRequestedRoomsDraft(0);

    setDraftMeta(null);
    setDraftLecturer(null);
    setDraftCoLecturers([]);

    setRooms([]);
  }

  function openCreate() {
    setMsg(null);
    setError(null);
    resetFormToDefaults();
    if (!lecturerId && lecturers.length) setLecturerId(String(getId(lecturers[0])));
    setCreateOpen(true);
  }

  function openEdit(exam) {
    setMsg(null);
    setError(null);
    setDraftMeta(null);
    setDraftLecturer(null);
    setDraftCoLecturers([]);

    setEditExam(exam);

    setCourseName(exam?.courseName || "");
    setExamMode(exam?.examMode || "onsite");
    setStartAt(toLocalInputValue(exam?.startAt || exam?.examDate || Date.now()));
    setEndAt(toLocalInputValue(exam?.endAt || Date.now() + 60 * 60 * 1000));

    const lec = exam?.lecturer?.id || exam?.lecturerId || "";
    setLecturerId(String(lec || ""));

    const cls = safeArr(exam?.classrooms, []).map((r) => ({
      _uid: nextRoomUid(),
      id: String(r?.id || r?.name || "").trim(),
      name: String(r?.name || r?.id || "").trim(),
      rows: Number(r?.rows || 5),
      cols: Number(r?.cols || 5),
      assignedSupervisorId: r?.assignedSupervisorId ? String(r.assignedSupervisorId) : "",
      assignedSupervisorName: String(r?.assignedSupervisorName || ""),
    }));

    const supByRoom = new Map(
      safeArr(exam?.supervisors, [])
        .map((s) => [String(s?.roomId || "").trim(), { id: String(s?.id || ""), name: String(s?.name || "") }])
        .filter(([k]) => !!k)
    );

    const merged = cls.map((r) => {
      const hit = supByRoom.get(String(r.id || "").trim());
      if (hit?.id && !r.assignedSupervisorId) {
        return { ...r, assignedSupervisorId: hit.id, assignedSupervisorName: hit.name || r.assignedSupervisorName };
      }
      return r;
    });

    setRooms(merged.length ? merged : cls);
    setEditOpen(true);
  }

  function validateCommon() {
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Please enter valid Start/End date and time.");
    }
    if (end.getTime() <= start.getTime()) {
      throw new Error("End time must be after Start time.");
    }
    if (!courseName.trim()) {
      throw new Error("Course name is required.");
    }
    if (!lecturerId) {
      throw new Error("Please choose a lecturer.");
    }

    const cleanRooms = safeArr(rooms, [])
      .map((r) => ({
        _uid: r?._uid,
        id: String(r?.id || r?.name || "").trim(),
        name: String(r?.name || r?.id || "").trim(),
        rows: Number(r?.rows || 5),
        cols: Number(r?.cols || 5),
        assignedSupervisorId: r?.assignedSupervisorId ? String(r.assignedSupervisorId) : null,
        assignedSupervisorName: String(r?.assignedSupervisorName || ""),
      }))
      .filter((r) => r.id && r.name);

    if (!cleanRooms.length) throw new Error("Please add at least 1 classroom (or use Auto-Assign).");

    const missing = cleanRooms.filter((r) => !r.assignedSupervisorId);
    if (missing.length) {
      throw new Error("Please assign a supervisor for each classroom (or use Auto-Assign in Create modal).");
    }

    return { start, end, cleanRooms };
  }

  function roomsToSupervisorIds(cleanRooms) {
    const ids = cleanRooms.map((r) => String(r.assignedSupervisorId || "")).filter(Boolean);
    return uniq(ids);
  }

  // ✅ Optimistic local update helpers (no UI/design change)
  function upsertExamLocal(examLike) {
    const id = getId(examLike);
    if (!id) return;
    setExams((prev) => {
      const copy = [...safeArr(prev, [])];
      const idx = copy.findIndex((x) => String(getId(x)) === String(id));
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], ...examLike };
        return copy;
      }
      return [examLike, ...copy];
    });
  }

  function removeExamLocal(examId) {
    setExams((prev) => safeArr(prev, []).filter((x) => String(getId(x)) !== String(examId)));
  }

  async function submitCreateOrEdit({ isEdit }) {
    setSaving(true);
    setMsg(null);
    setError(null);

    try {
      const { start, end, cleanRooms } = validateCommon();

      const payload = {
        courseName: courseName.trim(),
        examMode,
        examDate: start.toISOString(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        lecturerId,
        supervisorIds: roomsToSupervisorIds(cleanRooms),
        classrooms: cleanRooms.map((r) => {
          const { _uid, ...rest } = r;
          return rest;
        }),
      };

      if (!isEdit && draftLecturer) {
        payload.lecturer = draftLecturer;
        payload.coLecturers = safeArr(draftCoLecturers, []);
      }

      if (!isEdit) {
        const res = await createExam(payload);
        // if API returns created exam -> use it, else silent refresh will reconcile
        const created = res?.exam || res?.data?.exam;
        if (created) upsertExamLocal(created);

        showMsg("Exam created successfully.", 2500);
        setCreateOpen(false);
        setEditExam(null);
      } else {
        const examId = getId(editExam);
        if (!examId) throw new Error("Missing exam id");

        const res = await updateExamAdmin(examId, payload);
        const updated = res?.exam || res?.data?.exam;
        if (updated) upsertExamLocal(updated);

        showMsg("Exam updated successfully.", 2500);
        setEditOpen(false);
        setEditExam(null);
      }

      // ✅ silent refresh (keeps screen, no RocketLoader)
      await refresh({ silent: true });
    } catch (e2) {
      setError(e2?.message || "Failed to save exam");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteExam(examId) {
    if (!examId) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await deleteExamAdmin(examId);

      // ✅ instant local remove
      removeExamLocal(examId);

      showMsg("Exam deleted successfully.", 2500);
      setEditOpen(false);
      setEditExam(null);

      await refresh({ silent: true });
    } catch (e) {
      setError(e?.message || "Failed to delete exam");
    } finally {
      setSaving(false);
    }
  }

  async function onStartExam(exam) {
    const id = getId(exam);
    if (!id) return;

    const ws = windowState(exam);
    if (!ws.active) {
      setError(ws.future ? "Cannot start exam yet (start time hasn't arrived)." : "Cannot start exam (time window ended).");
      return;
    }

    setWorkingId(id);
    setMsg(null);
    setError(null);

    try {
      await startExam(id);

      // ✅ local fast status update (keeps UI snappy)
      upsertExamLocal({ ...exam, status: "running" });

      showMsg("Exam started (status set to running).", 2500);
      await refresh({ silent: true });
    } catch (e) {
      setError(e?.message || "Failed to start exam");
    } finally {
      setWorkingId(null);
    }
  }

  async function onEndExam(exam) {
    const id = getId(exam);
    if (!id) return;

    const ws = windowState(exam);
    if (!ws.active) {
      setError("Cannot end exam outside its real time window.");
      return;
    }

    setWorkingId(id);
    setMsg(null);
    setError(null);

    try {
      await endExam(id);

      // ✅ local fast status update
      upsertExamLocal({ ...exam, status: "ended" });

      showMsg("Exam ended (status set to ended).", 2500);
      await refresh({ silent: true });
    } catch (e) {
      setError(e?.message || "Failed to end exam");
    } finally {
      setWorkingId(null);
    }
  }

  // ✅ Create Modal ONLY: Draft Auto-Assign
  async function onAutoAssignDraft() {
    setDraftBusy(true);
    setMsg(null);
    setError(null);

    try {
      const start = new Date(startAt);
      const end = new Date(endAt);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Please enter valid Start/End date and time.");
      }
      if (end.getTime() <= start.getTime()) {
        throw new Error("End time must be after Start time.");
      }

      const requestedRoomsFinal = Math.max(0, Number(requestedRoomsDraft || 0));

      const res = await autoAssignDraft({
        examDate: start.toISOString(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        totalStudents: Math.max(0, Number(totalStudentsDraft || 0)),
        requestedRooms: requestedRoomsFinal,
      });

      const draft = res?.draft || res?.data?.draft;
      if (!draft) throw new Error("Draft auto-assign failed (no draft returned).");

      const cls = safeArr(draft?.classrooms, []).map((r) => ({
        _uid: nextRoomUid(),
        id: String(r?.id || r?.name || "").trim(),
        name: String(r?.name || r?.id || "").trim(),
        rows: Number(r?.rows || 5),
        cols: Number(r?.cols || 5),
        assignedSupervisorId: r?.assignedSupervisorId ? String(r.assignedSupervisorId) : "",
        assignedSupervisorName: String(r?.assignedSupervisorName || ""),
      }));

      if (!cls.length) throw new Error("Draft returned no classrooms.");

      setRooms(cls);
      setDraftMeta(draft?.meta || null);

      const lec = draft?.lecturer || null;
      const co = safeArr(draft?.coLecturers, []);
      setDraftLecturer(lec);
      setDraftCoLecturers(co);

      if (lec?.id) setLecturerId(String(lec.id));

      showMsg("Auto-Assign draft created. Review rooms/supervisors, then Create.", 3200);
    } catch (e) {
      setError(e?.message || "Failed to auto-assign draft");
    } finally {
      setDraftBusy(false);
    }
  }

  function setRoomField(idx, key, value) {
    setRooms((prev) => {
      const copy = [...prev];
      const r = { ...(copy[idx] || {}) };
      r[key] = value;

      if (key === "id") r.name = String(value || "");
      if (key === "name") r.id = String(value || "");

      copy[idx] = r;
      return copy;
    });
  }

  function removeRoom(idx) {
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRoom() {
    setRooms((prev) => {
      const uid = nextRoomUid();
      const n = prev.length + 1;
      const id = `Room-${n}`;
      return [...prev, buildRoomDraft(uid, id)];
    });
  }

  function onSelectSupervisorForRoom(idx, supId) {
    const sup = supervisors.find((s) => String(getId(s)) === String(supId));
    setRooms((prev) => {
      const copy = [...prev];
      const r = { ...(copy[idx] || {}) };
      r.assignedSupervisorId = supId || "";
      r.assignedSupervisorName = sup?.fullName || "";
      copy[idx] = r;
      return copy;
    });
  }

  const stats = useMemo(() => {
    const list = safeArr(exams, []);
    const total = list.length;
    const running = list.filter((x) => String(x?.status).toLowerCase() === "running").length;
    const ended = list.filter((x) => String(x?.status).toLowerCase() === "ended").length;
    const scheduled = total - running - ended;
    return { total, running, ended, scheduled };
  }, [exams]);

  const filtered = useMemo(() => {
    let list = safeArr(exams, []);

    list = [...list].sort((a, b) => {
      const ta = new Date(a?.startAt || a?.examDate || 0).getTime();
      const tb = new Date(b?.startAt || b?.examDate || 0).getTime();
      return tb - ta;
    });

    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((e) => {
        const id = String(getId(e) || "").toLowerCase();
        const course = String(e?.courseName || "").toLowerCase();
        const mode = String(e?.examMode || "").toLowerCase();
        const roomsTxt = safeArr(e?.classrooms, [])
          .map((r) => String(r?.name || r?.id || "").toLowerCase())
          .join(" ");
        return id.includes(qq) || course.includes(qq) || mode.includes(qq) || roomsTxt.includes(qq);
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((e) => String(e?.status || "scheduled").toLowerCase() === statusFilter);
    }

    if (modeFilter !== "all") {
      list = list.filter((e) => String(e?.examMode || "onsite").toLowerCase() === modeFilter);
    }

    if (fromDate) {
      const from = new Date(fromDate).setHours(0, 0, 0, 0);
      list = list.filter((e) => {
        const t = new Date(e?.startAt || e?.examDate || 0).getTime();
        return t >= from;
      });
    }
    if (toDate) {
      const to = new Date(toDate).setHours(23, 59, 59, 999);
      list = list.filter((e) => {
        const t = new Date(e?.startAt || e?.examDate || 0).getTime();
        return t <= to;
      });
    }

    return list;
  }, [exams, q, statusFilter, modeFilter, fromDate, toDate]);

  const totalPages = useMemo(() => {
    const n = filtered.length;
    return Math.max(1, Math.ceil(n / pageSize));
  }, [filtered.length, pageSize]);

  const paged = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, modeFilter, fromDate, toDate, pageSize]);

  // eslint-disable-next-line no-unused-vars
  const _ = clockTick;

  // ✅ ONLY first load uses full page loader
  if (initialLoading) {
    return <RocketLoader />;
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-extrabold text-slate-900">Exam Management</div>
            <div className="text-sm text-slate-600 mt-1">
              Admin control: create, browse, filter, update, delete, and control start/end.
              <span className="font-semibold"> Start/End are enabled only during the real time window.</span>
            </div>

            <div className="text-xs text-slate-500 mt-1">
              ✅ Auto-Assign is available <span className="font-semibold">ONLY inside Create Exam modal</span>.
            </div>
          </div>
          <div className="flex gap-10">
            <Btn onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-4 text-lg font-semibold rounded-lg">
              + Create New Exam
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs text-emerald-700">Running</div>
            <div className="text-2xl font-extrabold text-emerald-800">{stats.running}</div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-xs text-sky-700">Scheduled</div>
            <div className="text-2xl font-extrabold text-sky-800">{stats.scheduled}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div className="text-xs text-slate-600">Ended</div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.ended}</div>
          </div>
        </div>
      </Card>

      {(error || msg) ? (
        <div
          className={`rounded-2xl border p-4 ${
            error ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {error || msg}
        </div>
      ) : null}

      {/* Search & Filters */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900">Search & Filters</div>
            <div className="text-sm text-slate-600">Find exams by course, room, mode, id, date range.</div>
          </div>
          <div className="text-sm text-slate-600">
            Showing <span className="font-bold text-slate-900">{filtered.length}</span> results
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-4">
          <div className="lg:col-span-4">
            <Field label="Search" hint="course / room / id / mode">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Web / A101 / running / 65a..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </Field>
          </div>

          <div className="lg:col-span-2">
            <Field label="Status">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                <option value="all">All</option>
                <option value="scheduled">Scheduled</option>
                <option value="running">Running</option>
                <option value="ended">Ended</option>
              </select>
            </Field>
          </div>

          <div className="lg:col-span-2">
            <Field label="Mode">
              <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                <option value="all">All</option>
                <option value="onsite">Onsite</option>
                <option value="online">Online</option>
              </select>
            </Field>
          </div>

          <div className="lg:col-span-2">
            <Field label="From">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
            </Field>
          </div>

          <div className="lg:col-span-2">
            <Field label="To">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-2">
            <Btn
              onClick={() => {
                setQ("");
                setStatusFilter("all");
                setModeFilter("all");
                setFromDate("");
                setToDate("");
              }}
              className="border border-slate-200 hover:bg-slate-50"
            >
              Clear filters
            </Btn>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Rows:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={20}>20</option>
            </select>

            <div className="flex items-center gap-2">
              <Btn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="border border-slate-200 hover:bg-slate-50">
                Prev
              </Btn>
              <div className="text-sm text-slate-700">
                Page <span className="font-bold">{page}</span> / {totalPages}
              </div>
              <Btn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="border border-slate-200 hover:bg-slate-50">
                Next
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      {/* Exams table */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900">Exams</div>
            <div className="text-sm text-slate-600">Start/End work only during the real time window (startAt → endAt).</div>
          </div>

          {/* ✅ show non-blocking refresh status */}
          {refreshing ? <div className="text-sm text-slate-600">Loading…</div> : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-3">Course</th>
                <th className="py-2 pr-3">Schedule</th>
                <th className="py-2 pr-3">Rooms</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((e) => {
                const examId = getId(e);
                const isWorking = workingId === examId;

                const ws = windowState(e);
                const windowActive = ws.active;
                const windowFuture = ws.future;

                const dbStatus = String(e?.status || "scheduled").toLowerCase();
                const displayStatus =
                  dbStatus === "ended" || dbStatus === "running"
                    ? dbStatus
                    : windowActive
                    ? "running"
                    : windowFuture
                    ? "scheduled"
                    : "ended";

                const roomsTxt =
                  safeArr(e.classrooms, [])
                    .map((r) => r?.name || r?.id)
                    .filter(Boolean)
                    .join(", ") || "--";

                const startTitle = windowActive
                  ? "Start / Resume exam (within real time window)"
                  : windowFuture
                  ? "Cannot start yet (before start time)"
                  : "Cannot start (time window ended)";

                const endTitle = windowActive ? "End exam now (within real time window)" : "Cannot end outside exam time window";

                return (
                  <tr key={String(examId)} className="border-t border-slate-100">
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{e.courseName || "--"}</div>
                      <div className="text-xs text-slate-500">
                        {fmtShort(e.startAt || e.examDate)} • {Array.isArray(e?.supervisors) ? e.supervisors.length : 0} supervisors
                      </div>
                    </td>

                    <td className="py-3 pr-3 text-slate-700">
                      <div>{fmtDT(e.startAt)}</div>
                      <div className="text-xs text-slate-500">→ {fmtDT(e.endAt)}</div>
                    </td>

                    <td className="py-3 pr-3 text-slate-700">{roomsTxt}</td>

                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center rounded-xl border px-2 py-1 ${modeBadge(e.examMode)}`}>{String(e.examMode || "onsite")}</span>
                    </td>

                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center rounded-xl border px-2 py-1 ${statusBadge(displayStatus)}`}>{displayStatus}</span>
                    </td>

                    <td className="py-3 pr-3 text-xs text-slate-500">
                      <div className="font-mono">{String(examId || "--")}</div>
                    </td>

                    <td className="py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Btn onClick={() => openEdit(e)} className="border border-slate-200 hover:bg-slate-50" title="Edit exam details">
                          Edit
                        </Btn>

                        <Btn onClick={() => onStartExam(e)} disabled={isWorking || !windowActive} className="bg-emerald-600 hover:bg-emerald-700 text-white" title={startTitle}>
                          {isWorking ? "Working…" : "Start"}
                        </Btn>

                        <Btn
                          onClick={() =>
                            openConfirm({
                              title: "End exam now?",
                              text: "This will set status to ENDED. You can still START again while the exam is ACTIVE by time window.",
                              action: () => onEndExam(e),
                            })
                          }
                          disabled={isWorking || !windowActive}
                          className="bg-rose-600 hover:bg-rose-700 text-white"
                          title={endTitle}
                        >
                          End
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!refreshing && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-600">
                    No exams found with current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* =========================
          Create Modal (Auto-Assign ONLY here)
      ========================= */}
      <Modal
        open={createOpen}
        title="Create New Exam"
        subtitle="Clear flow: ① Details → ② Auto-Assign (optional) → ③ Review rooms → Create"
        onClose={() => (!saving ? setCreateOpen(false) : null)}
        maxWidth="max-w-3xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Btn onClick={() => setCreateOpen(false)} disabled={saving || draftBusy} className="border border-slate-200 hover:bg-white">
              Cancel
            </Btn>

            <Btn
              onClick={() =>
                openConfirm({
                  title: "Create exam?",
                  text: "Do you want to create this exam with the selected rooms and supervisors?",
                  action: () => submitCreateOrEdit({ isEdit: false }),
                })
              }
              disabled={saving || draftBusy}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {saving ? "Creating…" : "Create Exam"}
            </Btn>
          </div>
        }
      >
        {/* === (your modal content unchanged) === */}
        {/* I kept everything the same below - exactly your UI/logic */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <SectionTitle title="① Exam Details" desc="Fill the basics. Nothing is guessed." />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Course name">
                <input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </Field>

              <Field label="Mode">
                <select value={examMode} onChange={(e) => setExamMode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="onsite">Onsite</option>
                  <option value="online">Online</option>
                </select>
              </Field>

              <Field label="Start">
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </Field>

              <Field label="End">
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </Field>

              <Field label="Lecturer" hint="Main lecturer (auto-assign may override for grouping)">
                <select value={lecturerId} onChange={(e) => setLecturerId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                  {lecturers.length === 0 ? <option value="">No lecturers</option> : null}
                  {lecturers.map((l) => (
                    <option key={String(getId(l))} value={String(getId(l))}>
                      {l.fullName} ({l.username})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-600">Rooms currently in list</div>
                <div className="text-2xl font-extrabold text-slate-900">{rooms.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Starts from 0. Auto-Assign can grow or shrink this list.</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <SectionTitle title="② Auto-Assign (optional)" desc="Computes rooms by students (cap=25) and assigns 1 supervisor per room + lecturers grouping (1 per 3 rooms)." />

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Field label="Total students" hint="Auto decides rooms">
                <input type="number" min={0} value={totalStudentsDraft} onChange={(e) => setTotalStudentsDraft(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </Field>

              <Field label="Requested rooms (min)" hint="0 = AUTO">
                <input type="number" min={0} value={requestedRoomsDraft} onChange={(e) => setRequestedRoomsDraft(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </Field>

              <Field label="Draft result">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {draftMeta?.roomsUsed ? `rooms=${draftMeta.roomsUsed}, cap=${draftMeta.roomsCapacity || 25}` : "Not generated yet"}
                </div>
              </Field>

              <div className="flex items-end">
                <Btn onClick={onAutoAssignDraft} disabled={draftBusy || saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" title="Generate assignment draft">
                  {draftBusy ? "Working…" : "Auto-Assign"}
                </Btn>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-sm font-bold text-slate-900">Lecturers Assignment (1 per 3 rooms)</div>
              <div className="text-xs text-slate-600 mt-1">Rooms split into groups of 3. Main lecturer gets first group, co-lecturers get next groups.</div>

              {!draftLecturer ? (
                <div className="mt-3 text-sm text-slate-600">Not generated yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">Main Lecturer: {draftLecturer?.name || "--"}</div>
                    <div className="text-xs text-slate-600 mt-1">Rooms: {(draftLecturer?.roomIds || []).join(", ") || "--"}</div>
                  </div>

                  {draftCoLecturers.length ? (
                    <div className="space-y-2">
                      {draftCoLecturers.map((x, i) => (
                        <div key={String(x?.id || i)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-sm font-semibold text-slate-900">Co-Lecturer #{i + 1}: {x?.name || "--"}</div>
                          <div className="text-xs text-slate-600 mt-1">Rooms: {(x?.roomIds || []).join(", ") || "--"}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 mt-2">No co-lecturers needed for this rooms count.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="③ Classrooms & Supervisors" desc="You can add/remove rooms. Each room must have a supervisor." />
              <Btn onClick={addRoom} className="border border-slate-200 hover:bg-slate-50">
                + Add room
              </Btn>
            </div>

            <div className="mt-3 space-y-3">
              {!rooms.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  No rooms yet. Use <span className="font-semibold">Auto-Assign</span> (recommended) or <span className="font-semibold">+ Add room</span>.
                </div>
              ) : null}

              {rooms.map((r, idx) => (
                <div key={String(r._uid)} className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <Field label={`Room #${idx + 1} name`} hint="e.g. A101">
                        <input value={r.name || ""} onChange={(e) => setRoomField(idx, "name", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <Field label="Rows" hint="default 5">
                        <input type="number" min={1} value={Number(r.rows || 5)} onChange={(e) => setRoomField(idx, "rows", Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <Field label="Cols" hint="default 5">
                        <input type="number" min={1} value={Number(r.cols || 5)} onChange={(e) => setRoomField(idx, "cols", Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-4">
                      <Field label="Supervisor">
                        <select value={r.assignedSupervisorId || ""} onChange={(e) => onSelectSupervisorForRoom(idx, e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                          <option value="">-- choose supervisor --</option>
                          {supervisors.map((s) => (
                            <option key={String(getId(s))} value={String(getId(s))}>
                              {s.fullName} ({s.username})
                            </option>
                          ))}
                        </select>
                      </Field>
                      {r.assignedSupervisorName ? (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Assigned: <span className="font-semibold">{r.assignedSupervisorName}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <Btn onClick={() => removeRoom(idx)} className="border border-rose-200 text-rose-700 hover:bg-rose-50" title="Remove room" disabled={rooms.length <= 1}>
                        ✕
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================
          Edit Modal (NO Auto-Assign here)
      ========================= */}
      <Modal
        open={editOpen}
        title="Edit Exam"
        subtitle="Rooms and supervisors are shown dynamically from the exam."
        onClose={() => (!saving ? setEditOpen(false) : null)}
        maxWidth="max-w-3xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Btn
              onClick={() => {
                const id = getId(editExam);
                const course = String(editExam?.courseName || "").trim() || "--";
                openConfirm({
                  title: "Delete exam?",
                  text: `You are about to delete this exam:\n\nCourse: ${course}\nID: ${String(id || "--")}\n\nThis action cannot be undone.`,
                  action: () => onDeleteExam(id),
                });
              }}
              disabled={saving}
              className="border border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              Delete
            </Btn>

            <Btn
              onClick={() =>
                openConfirm({
                  title: "Update exam?",
                  text: "Are you sure you want to save these changes?",
                  action: () => submitCreateOrEdit({ isEdit: true }),
                })
              }
              disabled={saving}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {saving ? "Saving…" : "Update & Save"}
            </Btn>
          </div>
        }
      >
        {/* === your edit modal unchanged below === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field label="Course name">
            <input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </Field>

          <Field label="Mode">
            <select value={examMode} onChange={(e) => setExamMode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
              <option value="onsite">Onsite</option>
              <option value="online">Online</option>
            </select>
          </Field>

          <Field label="Start">
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </Field>

          <Field label="End">
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </Field>

          <Field label="Lecturer">
            <select value={lecturerId} onChange={(e) => setLecturerId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
              {lecturers.length === 0 ? <option value="">No lecturers</option> : null}
              {lecturers.map((l) => (
                <option key={String(getId(l))} value={String(getId(l))}>
                  {l.fullName} ({l.username})
                </option>
              ))}
            </select>
          </Field>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Classrooms & Supervisors (from this exam)</div>
                <div className="text-xs text-slate-500 mt-1">Edit any room/supervisor. You can also add/remove rooms here.</div>
              </div>

              <Btn onClick={addRoom} className="border border-slate-200 hover:bg-slate-50">
                + Add room
              </Btn>
            </div>

            <div className="mt-4 space-y-3">
              {rooms.map((r, idx) => (
                <div key={String(r._uid || `${r.id}-${idx}`)} className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <Field label={`Room #${idx + 1} name`}>
                        <input value={r.name || ""} onChange={(e) => setRoomField(idx, "name", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <Field label="Rows">
                        <input type="number" min={1} value={Number(r.rows || 5)} onChange={(e) => setRoomField(idx, "rows", Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <Field label="Cols">
                        <input type="number" min={1} value={Number(r.cols || 5)} onChange={(e) => setRoomField(idx, "cols", Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                      </Field>
                    </div>

                    <div className="md:col-span-4">
                      <Field label="Supervisor">
                        <select value={r.assignedSupervisorId || ""} onChange={(e) => onSelectSupervisorForRoom(idx, e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                          <option value="">-- choose supervisor --</option>
                          {supervisors.map((s) => (
                            <option key={String(getId(s))} value={String(getId(s))}>
                              {s.fullName} ({s.username})
                            </option>
                          ))}
                        </select>
                      </Field>
                      {r.assignedSupervisorName ? (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Assigned: <span className="font-semibold">{r.assignedSupervisorName}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <Btn onClick={() => removeRoom(idx)} className="border border-rose-200 text-rose-700 hover:bg-rose-50" title="Remove room" disabled={rooms.length <= 1}>
                        ✕
                      </Btn>
                    </div>
                  </div>
                </div>
              ))}

              {!rooms.length ? <div className="text-sm text-slate-600">No classrooms found in this exam.</div> : null}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        open={confirmOpen}
        title={confirmTitle}
        subtitle={null}
        onClose={() => (!saving ? setConfirmOpen(false) : null)}
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setConfirmOpen(false)} disabled={saving} className="border border-slate-200 hover:bg-white">
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                try {
                  setConfirmOpen(false);
                  if (confirmAction) await confirmAction();
                } catch (e) {
                  setError(e?.message || "Action failed");
                }
              }}
              disabled={saving}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Yes, continue
            </Btn>
          </div>
        }
      >
        <div className="text-sm text-slate-700 whitespace-pre-line">{confirmText}</div>
      </Modal>
    </div>
  );
}
