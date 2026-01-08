// ===== file: client/src/components/classroom/ClassroomMap.jsx =====
import { useEffect, useMemo, useRef, useState } from "react";
import SeatCard from "./SeatCard.jsx";
import SeatActionsModal from "./SeatActionsModal.jsx";
import { msToMMSS, parseSeat, safeStudentKey } from "./utils";

import { updateAttendance } from "../../services/exams.service";
import { createTransfer, cancelTransfer as apiCancelTransfer } from "../../services/transfers.service";
import { logIncident } from "../../services/incidents.service";

import QrScanner from "./QrScanner.jsx";

/* =========================
   Helpers
========================= */
function buildRoomList(exam, attendance) {
  const fromExam = (exam?.classrooms || exam?.rooms || [])
    .map((r) => String(r?.id || r?.name || r).trim())
    .filter(Boolean);

  if (fromExam.length) return Array.from(new Set(fromExam));

  const set = new Set();
  for (const a of attendance || []) {
    const r = String(a?.roomId || a?.classroom || a?.room || "").trim();
    if (r) set.add(r);
  }
  return set.size ? Array.from(set) : ["A-101"];
}

function getRoomSpec5x5() {
  return { rows: 5, cols: 5 };
}

function colToGridCol(c) {
  if (c === 1) return 1;
  if (c === 2) return 2;
  if (c === 3) return 4;
  if (c === 4) return 6;
  if (c === 5) return 7;
  return 1;
}

function normRoom(x) {
  return String(x || "").trim();
}

// ✅ One source of truth: supports roomId/classroom/room
function getRoomKey(a) {
  return normRoom(a?.roomId || a?.classroom || a?.room);
}

function normStatus(s) {
  return String(s || "").trim().toLowerCase();
}

function alphaName(a) {
  return String(a?.name || a?.fullName || "").toLowerCase();
}

export default function ClassroomMap({
  exam,
  me,
  refreshNow,
  nowMs = Date.now(),
  forcedRoomId = null,
  forcedAttendance = null,
  forcedTransfers = null,
  allRooms = null,
  hideRoomSwitcher = true, // kept for API compatibility
  reportStudentFiles = null,
}) {
  const meRole = String(me?.role || "").toLowerCase();

  // roles
  const isSupervisor = meRole === "supervisor";
  const isLecturer = meRole === "lecturer";
  const isAdmin = meRole === "admin";
  const canCallLecturer = isSupervisor || isAdmin;

  // ✅ permissions (single source of truth)
  const canEditAttendance = isSupervisor || isLecturer || isAdmin;
  const canRequestTransfer = isSupervisor || isLecturer || isAdmin;

  const attendanceSrc = forcedAttendance || exam?.attendance || [];
  const transfersSrc = forcedTransfers || [];

  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [toast, setToast] = useState(null);

  // roster UI
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [rosterFilter, setRosterFilter] = useState("all"); // all | not_arrived | absent | finished | present | temp_out | transfer

  // optimistic patches (for status changes only)
  const [localAttendance, setLocalAttendance] = useState(attendanceSrc || []);
  const pendingRef = useRef(new Map());
  const commitTimeoutMs = 7000;

  // local shadow copies for transfers (only when we inject missing student)
  const [localTransferShadow, setLocalTransferShadow] = useState(() => new Map());

  // QR scanner state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanId, setScanId] = useState("");

  // avoid toast timers leaking
  const toastTimerRef = useRef(null);
  function showToast(text, type = "ok") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const filesByStudentId = reportStudentFiles || exam?.reportStudentFiles || {};

  function getStudentFileByAttendance(a) {
    const sid = String(a?.studentId || "");
    if (!sid) return null;
    return filesByStudentId[sid] || null;
  }

  const roomList = useMemo(() => {
    const fromHook = (allRooms || [])
      .map((r) => String(r?.id || r?.name || r).trim())
      .filter(Boolean);

    if (fromHook.length) return Array.from(new Set(fromHook));
    return buildRoomList(exam, attendanceSrc);
  }, [allRooms, exam, attendanceSrc]);

  const activeRoom = useMemo(() => {
    const list = roomList || [];

    // ✅ lecturers/admins: room comes from dashboard header (forcedRoomId) if exists
    if (isLecturer || isAdmin) {
      const fr = String(forcedRoomId || "").trim();
      if (fr && list.includes(fr)) return fr;
      return list[0] || "";
    }

    if (isSupervisor && me?.assignedRoomId) {
      const sr = String(me.assignedRoomId).trim();
      if (sr && list.includes(sr)) return sr;
      return sr || list[0] || "";
    }

    return list[0] || "";
  }, [roomList, forcedRoomId, isLecturer, isAdmin, isSupervisor, me?.assignedRoomId]);

  // reconcile local attendance whenever server snapshot changes
  useEffect(() => {
    const serverList = Array.isArray(attendanceSrc) ? attendanceSrc : [];

    setLocalAttendance(() => {
      const now = Date.now();
      const next = serverList.map((x) => ({ ...x }));

      for (const item of next) {
        const sid = String(item?.studentId ?? "");
        if (!sid) continue;

        const pending = pendingRef.current.get(sid);
        if (!pending) continue;

        const serverStatus = normStatus(item?.status);
        const wantStatus = normStatus(pending.patch?.status);

        if (wantStatus && serverStatus === wantStatus) {
          pendingRef.current.delete(sid);
          continue;
        }

        if (now - pending.ts > commitTimeoutMs) {
          pendingRef.current.delete(sid);
          continue;
        }

        Object.assign(item, pending.patch);

        const nowISO = new Date().toISOString();
        if (wantStatus === "temp_out") item.outStartedAt = item.outStartedAt || nowISO;

        if (wantStatus === "present") {
          if (normStatus(item.status) === "temp_out") item.outStartedAt = null;
          item.arrivedAt = item.arrivedAt || nowISO;
        }

        if (wantStatus === "finished") item.finishedAt = item.finishedAt || nowISO;

        // ✅ not_arrived => we do NOT force arrivedAt here
        item.lastStatusAt = nowISO;
      }

      return next;
    });
  }, [attendanceSrc]);

  /**
   * pendingByStudent: sid -> { transferId, fromClassroom, toClassroom, fromSeat }
   */
  const pendingTransfersByStudent = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(transfersSrc) ? transfersSrc : [];

    for (const t of list) {
      const st = normStatus(t?.status);
      if (st !== "pending") continue;

      const sid = t?.studentId != null ? String(t.studentId) : "";
      if (!sid) continue;

      map.set(sid, {
        transferId: String(t?._id || t?.id || ""),
        fromClassroom: normRoom(t?.fromClassroom),
        toClassroom: normRoom(t?.toClassroom),
        fromSeat: String(t?.fromSeat || t?.seat || "").trim(),
      });
    }
    return map;
  }, [transfersSrc]);

  // clean local shadow when transfer no longer pending
  useEffect(() => {
    setLocalTransferShadow((prev) => {
      if (!prev || prev.size === 0) return prev;
      const next = new Map(prev);

      for (const [sid] of prev.entries()) {
        const stillPending = pendingTransfersByStudent.has(String(sid));
        if (!stillPending) next.delete(String(sid));
      }

      return next;
    });
  }, [pendingTransfersByStudent]);

  const roomAttendance = useMemo(() => {
    const list = Array.isArray(localAttendance) ? localAttendance : [];
    const r = normRoom(activeRoom);

    const hasAnyRoom = list.some((a) => Boolean(getRoomKey(a)));
    let base = hasAnyRoom ? list.filter((a) => getRoomKey(a) === r) : list;

    // 1) hide pending students in TO room (so they won't be duplicated)
    base = base.filter((a) => {
      const sid = String(a?.studentId || "");
      const tr = pendingTransfersByStudent.get(sid);
      if (!tr) return true;

      if (normRoom(tr.toClassroom) === r && normRoom(tr.fromClassroom) !== r) {
        return false;
      }
      return true;
    });

    // 2) ensure pending students exist in FROM room (inject shadow if missing)
    const existingIds = new Set(base.map((a) => String(a?.studentId || "")).filter(Boolean));

    for (const [sid, tr] of pendingTransfersByStudent.entries()) {
      if (normRoom(tr.fromClassroom) !== r) continue;
      if (existingIds.has(String(sid))) continue;

      const shadow = localTransferShadow.get(String(sid));

      base.push({
        studentId: sid,
        name: shadow?.name || "",
        studentNumber: shadow?.studentNumber || "",
        classroom: tr.fromClassroom || shadow?.fromClassroom || r,
        roomId: tr.fromClassroom || shadow?.fromClassroom || r,
        seat: tr.fromSeat || shadow?.fromSeat || "",
        status: shadow?.status || "present",
        arrivedAt: null,
        outStartedAt: null,
        finishedAt: null,
        lastStatusAt: null,
        violations: 0,
        transferPending: true,
      });

      existingIds.add(String(sid));
    }

    // 3) attach transferPending flag
    return base.map((a) => {
      const sid = String(a?.studentId || "");
      const transferPending = Boolean(sid && pendingTransfersByStudent.has(sid));
      return { ...a, transferPending };
    });
  }, [localAttendance, activeRoom, pendingTransfersByStudent, localTransferShadow]);

  // ✅ ALL students in this room (for roster)
  const studentsInRoom = useMemo(() => {
    return (roomAttendance || []).slice().sort((a, b) => alphaName(a).localeCompare(alphaName(b)));
  }, [roomAttendance]);

  // ✅ filtered roster list
  const rosterFiltered = useMemo(() => {
    const list = studentsInRoom || [];
    if (rosterFilter === "all") return list;

    if (rosterFilter === "transfer") {
      return list.filter((a) => Boolean(a?.transferPending) || normStatus(a?.status) === "moving");
    }

    return list.filter((a) => normStatus(a?.status) === rosterFilter);
  }, [studentsInRoom, rosterFilter]);

  const maxPreview = 9;
  const visibleRoster = showAllStudents ? rosterFiltered : rosterFiltered.slice(0, maxPreview);
  const moreCount = Math.max(0, rosterFiltered.length - visibleRoster.length);

  useEffect(() => {
    setShowAllStudents(false);
    setRosterFilter("all");
  }, [activeRoom]);

  const spec = useMemo(() => getRoomSpec5x5(), []);

  const seatMap = useMemo(() => {
    const map = new Map();
    for (const a of roomAttendance) {
      const p = parseSeat(a?.seat);
      if (!p) continue;
      if (p.r < 1 || p.r > spec.rows || p.c < 1 || p.c > spec.cols) continue;
      map.set(`${p.r}-${p.c}`, a);
    }
    return map;
  }, [roomAttendance, spec.rows, spec.cols]);

  const selectedSeat = useMemo(() => {
    if (!selectedStudentId) return null;
    return roomAttendance.find((x) => String(x.studentId) === String(selectedStudentId)) || null;
  }, [selectedStudentId, roomAttendance]);

  const selectedStudentFile = useMemo(() => {
    if (!selectedSeat) return null;
    return getStudentFileByAttendance(selectedSeat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeat, filesByStudentId]);

  function getElapsedMs(a) {
    const raw = normStatus(a?.status);
    if (raw !== "temp_out") return 0;
    const start = a?.outStartedAt ? new Date(a.outStartedAt).getTime() : null;
    if (!start || !Number.isFinite(start)) return 0;
    return Math.max(0, nowMs - start);
  }

  function resolveStudentIdKey(idOrNumber) {
    const key = String(idOrNumber || "").trim();
    if (!key) return "";

    const list = Array.isArray(localAttendance) ? localAttendance : [];
    const found = list.find((x) => String(x.studentId) === key || String(x.studentNumber || "") === key);
    return found ? String(found.studentId) : key;
  }

  function applyOptimistic(studentId, patch) {
    const sid = String(studentId);
    const nowISO = new Date().toISOString();
    pendingRef.current.set(sid, { patch: { ...patch }, ts: Date.now() });

    setLocalAttendance((prev) =>
      (prev || []).map((x) => {
        const same = String(x.studentId) === sid || String(x.studentNumber || "") === sid;
        if (!same) return x;

        const next = { ...x, ...patch };

        if (patch?.status === "temp_out") next.outStartedAt = patch.outStartedAt || nowISO;

        if (patch?.status === "present") {
          if (normStatus(x.status) === "temp_out") next.outStartedAt = null;
          next.arrivedAt = x.arrivedAt || patch.arrivedAt || nowISO;
        }

        if (patch?.status === "finished") next.finishedAt = x.finishedAt || nowISO;

        // ✅ not_arrived should not "fake" arrivedAt
        next.lastStatusAt = nowISO;
        return next;
      })
    );
  }

  async function patchStatus(studentId, patch) {
    if (!exam?.id) return;
    setLocalError("");

    const resolvedId = resolveStudentIdKey(studentId);
    applyOptimistic(resolvedId, patch);

    try {
      setSaving(true);
      await updateAttendance({ examId: exam.id, studentId, patch });
      refreshNow?.();
    } catch (e) {
      pendingRef.current.delete(String(resolvedId));
      setLocalError(e?.message || String(e));
      refreshNow?.();
    } finally {
      setSaving(false);
    }
  }

  async function markPresentById(idText) {
    if (!canEditAttendance) {
      setLocalError("You don’t have permission to mark attendance.");
      return;
    }

    const id = String(idText || "").trim();
    if (!id) {
      setLocalError("Please scan/enter Student ID first.");
      return;
    }

    await patchStatus(id, {
      status: "present",
      classroom: activeRoom,
      roomId: activeRoom,
      arrivedAt: new Date().toISOString(),
    });

    showToast(`Marked ${id} as Present`, "ok");
    setScanId("");
  }

  async function markNotArrivedById(idText) {
    if (!canEditAttendance) {
      setLocalError("You don’t have permission to mark attendance.");
      return;
    }

    const id = String(idText || "").trim();
    if (!id) {
      setLocalError("Please scan/enter Student ID first.");
      return;
    }

    await patchStatus(id, { status: "not_arrived" });

    showToast(`Marked ${id} as Not arrived`, "ok");
    setScanId("");
  }

  async function callLecturerGlobal() {
    if (!exam?.id) return;
    try {
      setSaving(true);
      await logIncident(exam.id, null, {
        kind: "CALL_LECTURER",
        severity: "medium",
        note: `${isAdmin ? "Admin" : "Supervisor"} requested lecturer assistance in room ${activeRoom}`,
        meta: { room: activeRoom, by: me?.fullName || me?.username || "" },
      });
      showToast("Lecturer notified.", "ok");
      refreshNow?.();
    } catch (e) {
      setLocalError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function requestTransfer(seat, toRoom) {
    if (!exam?.id || !seat) return;
    setLocalError("");

    const sid = String(seat.studentId || "").trim();
    if (!sid) {
      setLocalError("Cannot request transfer: missing studentId.");
      return;
    }

    // save shadow
    setLocalTransferShadow((prev) => {
      const next = new Map(prev);
      next.set(sid, {
        fromClassroom: getRoomKey(seat) || activeRoom,
        fromSeat: String(seat?.seat || "").trim(),
        name: seat?.name || "",
        studentNumber: seat?.studentNumber || seat?.studentId || "",
        status: seat?.status || "present",
      });
      return next;
    });

    try {
      setSaving(true);
      await createTransfer({
        examId: exam.id,
        studentId: sid,
        toClassroom: toRoom,
        toSeat: "AUTO",
        note: `Requested by ${me?.fullName || me?.username} (from ${activeRoom})`,
      });

      showToast(`Transfer request sent to ${toRoom}`, "ok");
      refreshNow?.();
      setSelectedStudentId(null);
    } catch (e) {
      setLocalTransferShadow((prev) => {
        const next = new Map(prev);
        next.delete(sid);
        return next;
      });
      setLocalError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function cancelPendingTransfer(seat) {
    if (!exam?.id || !seat) return;
    setLocalError("");

    const sid = String(seat.studentId || "").trim();
    if (!sid) return setLocalError("Cannot cancel transfer: missing studentId.");

    const pending = pendingTransfersByStudent.get(sid);
    const transferId = String(pending?.transferId || "").trim();
    if (!transferId) return setLocalError("Cannot cancel: no pending transfer found for this student.");

    try {
      setSaving(true);
      await apiCancelTransfer(transferId);

      setLocalTransferShadow((prev) => {
        const next = new Map(prev);
        next.delete(sid);
        return next;
      });

      showToast("Transfer cancelled.", "ok");
      refreshNow?.();
      setSelectedStudentId(null);
    } catch (e) {
      setLocalError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function submitCheatNote(seat, text) {
    if (!exam?.id || !seat || !text) return;

    const studentKey = safeStudentKey(seat);
    if (!studentKey) {
      setLocalError("Cannot log incident: missing student identifier.");
      return;
    }

    setLocalError("");

    try {
      setSaving(true);
      await logIncident(exam.id, studentKey, {
        kind: "CHEAT_NOTE",
        severity: "high",
        note: text,
        meta: {
          seat: seat?.seat || "",
          room: getRoomKey(seat) || "",
          by: me?.fullName || me?.username || "",
        },
      });

      showToast("Note saved (report + student file).", "ok");
      refreshNow?.();
      setSelectedStudentId(null);
    } catch (e) {
      setLocalError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const totalSeats = spec.rows * spec.cols;
  const placedCount = seatMap.size;

  const activeClassroom = useMemo(() => {
    return (exam?.classrooms || []).find((c) => String(c.id) === String(activeRoom));
  }, [exam?.classrooms, activeRoom]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Live classroom</div>
              <div className="text-2xl font-extrabold text-slate-900">Classroom (5×5) • Room {activeRoom || "-"}</div>
              <div className="mt-1 text-sm text-slate-600">Click a seat for actions • Use QR / ID to mark present</div>

              {localError ? (
                <div className="mt-3 text-sm rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 px-4 py-3">
                  {localError}
                </div>
              ) : null}

              {toast ? (
                <div
                  className={`mt-3 text-sm rounded-2xl border px-4 py-3 ${
                    toast.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  {toast.text}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xs text-slate-500">Placed</div>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-sm font-extrabold text-slate-900">
                  {placedCount} / {totalSeats}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
           {canCallLecturer && (
            <button
              onClick={callLecturerGlobal}
              disabled={saving}
              className="px-3 py-2 rounded-2xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
            >
              🗣️ Call Lecturer
            </button>
          )}



            <button
              onClick={() => setCameraOpen((v) => !v)}
              className="px-3 py-2 rounded-2xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
            >
              {cameraOpen ? "📷 Close Camera" : "📷 Open Camera"}
            </button>

            <div className="flex items-center gap-2">
              <input
                value={scanId}
                onChange={(e) => setScanId(e.target.value)}
                placeholder="Scan / Enter Student ID"
                className="w-56 max-w-[70vw] px-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />

              <button
                onClick={() => markPresentById(scanId)}
                disabled={saving || !canEditAttendance}
                className="px-3 py-2 rounded-2xl text-sm font-extrabold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                title={!canEditAttendance ? "No permission" : ""}
              >
                Mark Present
              </button>

              <button
                onClick={() => markNotArrivedById(scanId)}
                disabled={saving || !canEditAttendance}
                className="px-3 py-2 rounded-2xl text-sm font-extrabold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60"
                title={!canEditAttendance ? "No permission" : ""}
              >
                Mark Not Arrived
              </button>
            </div>

            {(isLecturer || isAdmin) ? (
              <div className="ml-auto text-[12px] text-slate-500 font-bold">Room is controlled from the Dashboard header.</div>
            ) : null}
          </div>

          {cameraOpen ? (
            <QrScanner
              open={cameraOpen}
              onResult={(text) => setScanId(String(text || "").trim())}
              onError={(msg) => setLocalError(String(msg || "Camera error"))}
              fps={10}
              qrbox={240}
              facingMode="environment"
            />
          ) : null}
        </div>
      </div>

      <div className="p-5 bg-slate-50">
        {/* ✅ Roster (ALL statuses) */}
        {studentsInRoom.length > 0 ? (
          <div className="mb-4 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-900">Students in Room {activeRoom}</div>
                <div className="text-xs text-slate-500 font-bold">Total: {studentsInRoom.length}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterChip label="All" active={rosterFilter === "all"} onClick={() => setRosterFilter("all")} />
                <FilterChip
                  label="Not arrived"
                  active={rosterFilter === "not_arrived"}
                  onClick={() => setRosterFilter("not_arrived")}
                />
                <FilterChip label="Absent" active={rosterFilter === "absent"} onClick={() => setRosterFilter("absent")} />
                <FilterChip
                  label="Finished"
                  active={rosterFilter === "finished"}
                  onClick={() => setRosterFilter("finished")}
                />
                <FilterChip label="Present" active={rosterFilter === "present"} onClick={() => setRosterFilter("present")} />
                <FilterChip label="Out" active={rosterFilter === "temp_out"} onClick={() => setRosterFilter("temp_out")} />
                <FilterChip
                  label="Transfer"
                  active={rosterFilter === "transfer"}
                  onClick={() => setRosterFilter("transfer")}
                />

                <div className="ml-auto flex items-center gap-2">
                  {moreCount > 0 ? (
                    <button
                      onClick={() => setShowAllStudents(true)}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100"
                    >
                      +{moreCount} more
                    </button>
                  ) : null}

                  {showAllStudents && rosterFiltered.length > maxPreview ? (
                    <button
                      onClick={() => setShowAllStudents(false)}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      Collapse
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-wrap gap-2">
              {visibleRoster.map((a) => {
                const st = normStatus(a?.status);

                // ✅ IMPORTANT: fill the input with "studentNumber" if exists, otherwise "studentId"
                // This prevents filling Mongo _id by mistake.
                const idForMark = String(a?.studentNumber || a?.studentId || "").trim();
                const sidDisplay = String(a?.studentNumber || a?.studentId || "-");
                const name = String(a?.name || "Student");

                return (
                  <button
                    key={String(a?.studentId || sidDisplay)}
                    onClick={() => setScanId(idForMark)}
                    className="text-left rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100"
                    title="Click to fill the input"
                  >
                    <div className="text-[12px] font-extrabold text-slate-900 truncate max-w-[220px]">{name}</div>
                    <div className="text-[11px] text-slate-600 font-bold">
                      ID {sidDisplay} • <span className="uppercase">{st}</span>
                      {a?.transferPending ? <span className="ml-2 text-purple-700">• PENDING</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-3xl border border-slate-200 bg-white shadow-sm p-4 text-sm text-slate-600">
            No students found for Room {activeRoom}.
          </div>
        )}

        {/* Map */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-extrabold text-slate-900">Classroom Map</div>
          </div>

          <div className="relative w-full h-[620px] md:h-[680px] bg-gradient-to-b from-slate-50 to-white">
            <div className="absolute left-1/2 top-4 -translate-x-1/2 w-[min(200px,92%)] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-extrabold text-slate-800 shadow-sm">
              🚪 Door : Exit
            </div>

            <div className="absolute left-1/2 top-[88px] -translate-x-1/2 w-[min(980px,96%)]">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 1fr 0.6fr 1fr 0.6fr 1fr 1fr",
                  gridTemplateRows: "repeat(5, 1fr)",
                  gap: "18px",
                }}
              >
                {Array.from({ length: 25 }).map((_, idx) => {
                  const r = Math.floor(idx / 5) + 1;
                  const c = (idx % 5) + 1;

                  const gridCol = colToGridCol(c);
                  const key = `${r}-${c}`;
                  const a = seatMap.get(key);

                  const sf = a ? getStudentFileByAttendance(a) : null;
                  const toiletCount = Number(sf?.toiletCount || 0);

                  return (
                    <div key={`seat-${key}`} style={{ gridColumn: gridCol, gridRow: r, height: "86px", minWidth: 0 }}>
                      {a ? (
                        <SeatCard
                          a={a}
                          elapsedMs={getElapsedMs(a)}
                          toiletCount={toiletCount}
                          onClick={() => setSelectedStudentId(String(a.studentId))}
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded-2xl border border-slate-200 bg-slate-50/70 grid place-items-center text-[11px] text-slate-400"
                          title="Empty seat"
                        >
                          Empty
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute left-1/2 bottom-5 -translate-x-1/2">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 w-[min(320px,86vw)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 font-bold">Supervisor</div>
                    <div className="text-sm font-extrabold text-slate-900 truncate">
                      {activeClassroom?.assignedSupervisorName || "Supervisor"}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Room <span className="font-extrabold text-slate-900">{activeRoom || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <LegendDot color="bg-slate-300" label="Not arrived" />
              <LegendDot color="bg-emerald-500" label="Present" />
              <LegendDot color="bg-amber-500" label="Out" />
              <LegendDot color="bg-purple-500" label="Transfer" />
              <LegendDot color="bg-rose-500" label="Finished" />
              <LegendDot color="bg-slate-500" label="Absent" />
            </div>
          </div>
        </div>
      </div>

      <SeatActionsModal
        open={Boolean(selectedSeat)}
        onClose={() => setSelectedStudentId(null)}
        seat={selectedSeat}
        studentFile={selectedStudentFile}
        elapsedMs={selectedSeat ? getElapsedMs(selectedSeat) : 0}
        saving={saving}
        isSupervisor={isSupervisor}
        canRequestTransfer={canRequestTransfer}
        canEditAttendance={canEditAttendance}
        rooms={roomList}
        onSetStatus={(studentId, patch) => patchStatus(studentId, patch)}
        onRequestTransfer={(seat, toRoom) => requestTransfer(seat, toRoom)}
        onCancelTransfer={(seat) => cancelPendingTransfer(seat)}
        onCheatNote={(seat, text) => submitCheatNote(seat, text)}
      />
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-extrabold px-3 py-1.5 rounded-2xl border ${
        active ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
      type="button"
    >
      {label}
    </button>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="font-semibold text-slate-700">{label}</span>
    </div>
  );
}
