// ===== file: server/src/controllers/exams.controller.js =====
import Exam from "../models/Exam.js";
import User from "../models/User.js";

/* =========================
   Helpers
========================= */

function toOut(doc) {
  const o = doc.toObject({ getters: true });
  return { ...o, id: String(o._id) };
}

function ensureReport(exam) {
  if (!exam.report) exam.report = {};
  if (!exam.report.summary) exam.report.summary = {};
  if (!Array.isArray(exam.report.timeline)) exam.report.timeline = [];

  if (!exam.report.studentFiles || typeof exam.report.studentFiles.get !== "function") {
    exam.report.studentFiles = new Map(Object.entries(exam.report.studentFiles || {}));
  }
  if (!exam.report.studentStats || typeof exam.report.studentStats.get !== "function") {
    exam.report.studentStats = new Map(Object.entries(exam.report.studentStats || {}));
  }
}

function getStudentFile(exam, studentIdKey) {
  ensureReport(exam);
  const key = String(studentIdKey);

  const existing = exam.report.studentFiles.get(key);
  if (existing) return existing;

  const file = {
    arrivedAt: null,
    finishedAt: null,

    toiletCount: 0,
    totalToiletMs: 0,
    activeToilet: {
      leftAt: null,
      bySupervisorId: null,
    },

    incidentCount: 0,
    violations: 0,

    notes: [],
    timeline: [],
  };

  exam.report.studentFiles.set(key, file);
  return file;
}

function pushExamTimeline(exam, payload) {
  ensureReport(exam);
  exam.report.timeline.push(payload);
}

function pushStudentTimeline(exam, studentIdKey, payload) {
  const file = getStudentFile(exam, studentIdKey);
  file.timeline.push(payload);
}

function actorFromReq(req) {
  const u = req.user || {};
  return {
    id: u.id || u._id || null,
    name: u.fullName || u.username || "",
    role: u.role || "",
  };
}

function studentSnapshot(att) {
  return {
    id: att.studentId || null,
    name: att.name || "",
    code: att.studentNumber || "",
    seat: att.seat || "",
    classroom: att.classroom || "",
  };
}

function recalcSummary(exam) {
  ensureReport(exam);

  const att = exam.attendance || [];
  const statuses = att.map((x) => String(x.status || ""));

  const sum = exam.report.summary;

  sum.totalStudents = att.length;
  sum.present = statuses.filter((s) => s === "present").length;
  sum.absent = statuses.filter((s) => s === "absent").length;
  sum.temp_out = statuses.filter((s) => s === "temp_out").length;
  sum.not_arrived = statuses.filter((s) => s === "not_arrived").length;
  sum.finished = statuses.filter((s) => s === "finished").length;

  sum.incidents = Array.isArray(exam.events) ? exam.events.length : 0;
  sum.violations = att.reduce((acc, a) => acc + (Number(a.violations) || 0), 0);
  sum.transfers = statuses.filter((s) => s === "moving").length;
}

function findAttendance(exam, studentIdOrNumber) {
  const key = String(studentIdOrNumber || "").trim();
  if (!key) return null;

  const list = exam.attendance || [];

  let att = list.find((x) => String(x.studentId) === key);
  if (att) return att;

  att = list.find((x) => String(x.studentNumber || "") === key);
  if (att) return att;

  return null;
}

/* =========================
   NEW: seating/capacity helpers
========================= */
function normalizeRoomId(v) {
  return String(v || "").trim();
}

function normalizeSeat(seat) {
  const s = String(seat || "").trim().toUpperCase();
  return s || "";
}

function roomDims(exam, roomId) {
  const rid = normalizeRoomId(roomId);
  const r = (exam?.classrooms || []).find((x) => normalizeRoomId(x?.id || x?.name) === rid);
  return { rows: Number(r?.rows || 5), cols: Number(r?.cols || 5) };
}

function seatLabel(r, c) {
  return `R${r}-C${c}`;
}

function isOccupyingStatus(status) {
  const s = String(status || "").toLowerCase();
  return ["present", "temp_out", "moving", "finished"].includes(s);
}


function roomCapacity(exam, roomId) {
  const { rows, cols } = roomDims(exam, roomId);
  const capacity = Math.max(0, rows * cols);
  return { rows, cols, capacity };
}

function roomOccupiedCount(exam, roomId) {
  const rid = normalizeRoomId(roomId);
  let occupied = 0;

  for (const a of exam.attendance || []) {
    const ar = normalizeRoomId(a.classroom || a.roomId);
    if (ar !== rid) continue;
    if (!isOccupyingStatus(a.status)) continue;
    occupied += 1;
  }
  return occupied;
}

function ensureSeatsForRoom(exam, roomId) {
  const rid = normalizeRoomId(roomId);
  const { rows, cols, capacity } = roomCapacity(exam, rid);
  if (capacity <= 0) return;

  const list = exam.attendance || [];

  const used = new Set(
    list
      .filter((a) => normalizeRoomId(a.classroom || a.roomId) === rid)
      .filter((a) => isOccupyingStatus(a.status))
      .map((a) => normalizeSeat(a.seat))
      .filter(Boolean)
  );

  for (const a of list) {
    if (normalizeRoomId(a.classroom || a.roomId) !== rid) continue;
    if (!isOccupyingStatus(a.status)) continue;

    const seat = normalizeSeat(a.seat);
    if (seat) continue;

    let found = "";
    for (let r = 1; r <= rows && !found; r++) {
      for (let c = 1; c <= cols; c++) {
        const label = seatLabel(r, c);
        if (!used.has(label)) {
          found = label;
          break;
        }
      }
    }

    if (!found) break;
    a.seat = found;
    used.add(found);
  }
}

function hasFreeSeat(exam, roomId) {
  const { capacity } = roomCapacity(exam, roomId);
  if (capacity <= 0) return false;
  return roomOccupiedCount(exam, roomId) < capacity;
}

function findFirstFreeSeat(exam, roomId) {
  const rid = normalizeRoomId(roomId);
  const { rows, cols } = roomDims(exam, rid);

  const used = new Set(
    (exam.attendance || [])
      .filter((a) => normalizeRoomId(a.classroom || a.roomId) === rid)
      .filter((a) => isOccupyingStatus(a.status))
      .map((a) => normalizeSeat(a.seat))
      .filter(Boolean)
  );

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const label = seatLabel(r, c);
      if (!used.has(label)) return label;
    }
  }
  return "";
}

function isSeatTaken(exam, roomId, seat) {
  const rid = normalizeRoomId(roomId);
  const s = normalizeSeat(seat);
  if (!s) return false;

  return (exam.attendance || []).some(
    (a) =>
      normalizeRoomId(a.classroom || a.roomId) === rid &&
      isOccupyingStatus(a.status) &&
      normalizeSeat(a.seat) === s
  );
}

/* =========================
   NEW: exam window helpers (for Start/End)
========================= */
function getExamWindowMs(exam) {
  const startMs = new Date(exam?.startAt || exam?.examDate || 0).getTime();
  const endMs = new Date(exam?.endAt || 0).getTime();
  return { startMs, endMs };
}

function examWindowState(exam) {
  const { startMs, endMs } = getExamWindowMs(exam);
  const nowMs = Date.now();

  const ok =
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    startMs > 0 &&
    endMs > 0 &&
    endMs > startMs;

  if (!ok) {
    return { ok: false, active: false, future: false, past: false, nowMs, startMs, endMs };
  }

  const active = nowMs >= startMs && nowMs <= endMs;
  const future = nowMs < startMs;
  const past = nowMs > endMs;
  return { ok: true, active, future, past, nowMs, startMs, endMs };
}

/* =========================
   NEW: create helpers (save names to DB)
========================= */

async function buildLecturerObject(lecturerId) {
  const lid = String(lecturerId || "").trim();
  if (!lid) return null;

  const lec = await User.findById(lid).select("fullName role").lean();
  if (!lec) throw new Error("Lecturer not found");
  if (lec.role !== "lecturer") throw new Error("Selected user is not a lecturer");

  return { id: lec._id, name: lec.fullName || "", roomIds: [] };
}

async function buildSupervisorsFromClassrooms(classrooms) {
  const rooms = Array.isArray(classrooms) ? classrooms : [];
  const pairs = rooms
    .map((r) => ({
      roomId: String(r?.id || r?.name || "").trim(),
      supId: r?.assignedSupervisorId ? String(r.assignedSupervisorId) : "",
      supNameHint: String(r?.assignedSupervisorName || "").trim(),
    }))
    .filter((x) => x.roomId && x.supId);

  if (!pairs.length) return [];

  const supUsers = await User.find({
    _id: { $in: pairs.map((x) => x.supId) },
    role: "supervisor",
  })
    .select("fullName")
    .lean();

  const byId = new Map(supUsers.map((u) => [String(u._id), u]));

  return pairs.map((p) => ({
    id: p.supId,
    name: byId.get(String(p.supId))?.fullName || p.supNameHint || "",
    roomId: p.roomId,
  }));
}

/* =========================
   Controllers
========================= */

// ✅ GET /api/exams
export async function getExams(req, res) {
  try {
    const me = req.user || {};
    const role = String(me.role || "");

    const exams = await Exam.find({}).sort({ startAt: -1 });

    let filtered = exams;

    if (role === "supervisor") {
      filtered = exams.filter((e) =>
        (e.supervisors || []).some((s) => String(s?.id) === String(me.id || me._id))
      );
    }

    if (role === "student") {
      filtered = exams.filter((e) =>
        (e.attendance || []).some((a) => String(a?.studentId) === String(me.id || me._id))
      );
    }

    return res.json({ ok: true, exams: filtered.map(toOut) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to load exams" });
  }
}

// ✅ GET /api/exams/:examId
export async function getExamById(req, res) {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    return res.json({ ok: true, exam: toOut(exam) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to load exam" });
  }
}

/**
 * ✅ PATCH /api/exams/:examId/attendance/:studentId
 */
export async function updateAttendance(req, res) {
  try {
    const { examId, studentId } = req.params;
    const patch = req.body || {};

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const att = findAttendance(exam, studentId);
    if (!att) return res.status(404).json({ message: "Student not found in attendance" });

    ensureReport(exam);
    const now = new Date();
    const actor = actorFromReq(req);

    const prevStatus = String(att.status || "");
    const nextStatus = patch.status !== undefined ? String(patch.status) : null;

    const realStudentKey = String(att.studentId);
    const sf = getStudentFile(exam, realStudentKey);
    const sSnap = studentSnapshot(att);

    /* ============ OPTIONAL: seat/classroom patch validation (safe, won't break existing) ============ */
    const wantsMove =
      patch.classroom !== undefined || patch.roomId !== undefined || patch.seat !== undefined;

    if (wantsMove) {
      const targetRoom = normalizeRoomId(
        patch.classroom ?? patch.roomId ?? att.classroom ?? att.roomId
      );
      const targetSeatRaw = patch.seat !== undefined ? String(patch.seat) : String(att.seat || "");
      const targetSeat = normalizeSeat(targetSeatRaw) || "AUTO";

      // fix broken seats in target room before validating
      ensureSeatsForRoom(exam, targetRoom);

      if (
        !hasFreeSeat(exam, targetRoom) &&
        normalizeRoomId(att.classroom || att.roomId) !== targetRoom
      ) {
        return res.status(409).json({ message: "ROOM_FULL" });
      }

      let finalSeat = "";
      if (targetSeat === "AUTO") {
        finalSeat = findFirstFreeSeat(exam, targetRoom);
      } else {
        if (!isSeatTaken(exam, targetRoom, targetSeat)) finalSeat = targetSeat;
        else finalSeat = findFirstFreeSeat(exam, targetRoom);
      }

      if (!finalSeat) return res.status(409).json({ message: "ROOM_FULL" });

      att.classroom = targetRoom;
      att.roomId = targetRoom;
      att.seat = finalSeat;
      att.lastStatusAt = now;

      pushStudentTimeline(exam, realStudentKey, {
        at: now,
        kind: "SEAT_UPDATE",
        note: `Seat/Classroom updated to ${targetRoom} ${finalSeat}`,
        severity: "low",
        classroom: targetRoom,
        seat: finalSeat,
        meta: { by: actor },
      });

      pushExamTimeline(exam, {
        kind: "SEAT_UPDATE",
        at: now,
        roomId: targetRoom,
        actor,
        student: { ...sSnap, classroom: targetRoom, seat: finalSeat },
        details: { classroom: targetRoom, seat: finalSeat },
      });
    }

    /* ============ Notes ============ */
    if (typeof patch.addNote === "string" && patch.addNote.trim()) {
      const note = patch.addNote.trim();
      sf.notes.push(note);

      pushStudentTimeline(exam, realStudentKey, {
        at: now,
        kind: "NOTE",
        note,
        severity: "low",
        classroom: att.classroom || "",
        seat: att.seat || "",
        meta: { by: actor },
      });

      pushExamTimeline(exam, {
        kind: "NOTE",
        at: now,
        roomId: att.classroom || "",
        actor,
        student: sSnap,
        details: { note },
      });
    }

    /* ============ Violations ============ */
    if (typeof patch.addViolation === "number" && patch.addViolation !== 0) {
      const delta = patch.addViolation;

      att.violations = (Number(att.violations) || 0) + delta;
      sf.violations = (Number(sf.violations) || 0) + delta;

      pushStudentTimeline(exam, realStudentKey, {
        at: now,
        kind: "VIOLATION",
        note: `Violation +${delta}`,
        severity: "medium",
        classroom: att.classroom || "",
        seat: att.seat || "",
        meta: { by: actor, delta },
      });

      pushExamTimeline(exam, {
        kind: "VIOLATION",
        at: now,
        roomId: att.classroom || "",
        actor,
        student: sSnap,
        details: { delta, total: att.violations || 0 },
      });
    }

    /* ============ Status Changes ============ */
    if (nextStatus) {
      const allowed = new Set(["not_arrived", "present", "temp_out", "absent", "moving", "finished"]);
      if (!allowed.has(nextStatus)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (prevStatus !== nextStatus) {
        att.status = nextStatus;

        // ✅ when leaving the room (not occupying) => free the seat
       // ✅ Do NOT clear seat for absent/not_arrived.
      // Seats stay reserved, so students don't disappear from the map.
      if (nextStatus === "not_arrived") {
        att.arrivedAt = null;       // still not arrived
        att.outStartedAt = null;    // not in toilet
      }

      if (nextStatus === "absent") {
        att.outStartedAt = null;    // not in toilet
      }

// (No att.seat clearing here)


        att.lastStatusAt = now;

        // ✅ if student becomes occupying and has no seat -> assign now (prevents phantom seating)
        if (isOccupyingStatus(nextStatus)) {
          const rid = normalizeRoomId(att.classroom || att.roomId);
          ensureSeatsForRoom(exam, rid);
          if (!att.seat || !String(att.seat).trim()) {
            const seat = findFirstFreeSeat(exam, rid);
            if (seat) att.seat = seat;
          }
        }

        if (prevStatus === "not_arrived" && nextStatus === "present") {
          att.arrivedAt = att.arrivedAt || now;
          sf.arrivedAt = sf.arrivedAt || now;

          pushStudentTimeline(exam, realStudentKey, {
            at: now,
            kind: "ARRIVED",
            note: "Student arrived",
            severity: "low",
            classroom: att.classroom || "",
            seat: att.seat || "",
            meta: { by: actor },
          });

          pushExamTimeline(exam, {
            kind: "ARRIVED",
            at: now,
            roomId: att.classroom || "",
            actor,
            student: sSnap,
            details: {},
          });
        }

        if (nextStatus === "temp_out" && prevStatus !== "temp_out") {
          att.outStartedAt = now;

          sf.toiletCount = (Number(sf.toiletCount) || 0) + 1;
          sf.activeToilet = { leftAt: now, bySupervisorId: actor.id || null };

          pushStudentTimeline(exam, realStudentKey, {
            at: now,
            kind: "TOILET_OUT",
            note: "Left to toilet",
            severity: "low",
            classroom: att.classroom || "",
            seat: att.seat || "",
            meta: { by: actor },
          });

          pushExamTimeline(exam, {
            kind: "TOILET_OUT",
            at: now,
            roomId: att.classroom || "",
            actor,
            student: sSnap,
            details: {},
          });
        }

        if (prevStatus === "temp_out" && nextStatus === "present") {
          const leftAt = att.outStartedAt ? new Date(att.outStartedAt) : null;

          if (leftAt && !Number.isNaN(leftAt.getTime())) {
            const deltaMs = now.getTime() - leftAt.getTime();
            sf.totalToiletMs = (Number(sf.totalToiletMs) || 0) + Math.max(0, deltaMs);
          }

          att.outStartedAt = null;
          sf.activeToilet = { leftAt: null, bySupervisorId: null };

          pushStudentTimeline(exam, realStudentKey, {
            at: now,
            kind: "TOILET_BACK",
            note: "Returned from toilet",
            severity: "low",
            classroom: att.classroom || "",
            seat: att.seat || "",
            meta: { by: actor },
          });

          pushExamTimeline(exam, {
            kind: "TOILET_BACK",
            at: now,
            roomId: att.classroom || "",
            actor,
            student: sSnap,
            details: {},
          });
        }

        if (nextStatus === "finished") {
          att.finishedAt = att.finishedAt || now;
          sf.finishedAt = sf.finishedAt || now;

          pushStudentTimeline(exam, realStudentKey, {
            at: now,
            kind: "FINISHED",
            note: "Student finished exam",
            severity: "low",
            classroom: att.classroom || "",
            seat: att.seat || "",
            meta: { by: actor },
          });

          pushExamTimeline(exam, {
            kind: "FINISHED",
            at: now,
            roomId: att.classroom || "",
            actor,
            student: sSnap,
            details: {},
          });
        }

        const isSpecial =
          (prevStatus === "not_arrived" && nextStatus === "present") ||
          nextStatus === "temp_out" ||
          (prevStatus === "temp_out" && nextStatus === "present") ||
          nextStatus === "finished";

        if (!isSpecial) {
          pushStudentTimeline(exam, realStudentKey, {
            at: now,
            kind: "STATUS",
            note: `Status: ${prevStatus} → ${nextStatus}`,
            severity: "low",
            classroom: att.classroom || "",
            seat: att.seat || "",
            meta: { by: actor },
          });

          pushExamTimeline(exam, {
            kind: "STATUS",
            at: now,
            roomId: att.classroom || "",
            actor,
            student: sSnap,
            details: { from: prevStatus, to: nextStatus },
          });
        }
      }
    }

    recalcSummary(exam);

    exam.markModified("attendance");
    exam.markModified("report");
    await exam.save();

    return res.json({ ok: true, exam: toOut(exam) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to update attendance" });
  }
}

/* ---- START / END EXAM ---- */
export async function startExam(req, res) {
  try {
    const { examId } = req.params;

    // supports: ?force=1  OR body { force:true }
    const force = String(req.query.force || "") === "1" || Boolean(req.body?.force);

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    ensureReport(exam);

    const now = new Date();
    const actor = actorFromReq(req);

    // ✅ Normal start: ONLY within the real time window
    if (!force) {
      const ws = examWindowState(exam);
      if (!ws.ok) return res.status(400).json({ message: "Invalid exam time window" });

      if (!ws.active) {
        return res.status(400).json({
          message: ws.future ? "EXAM_NOT_STARTED_YET" : "EXAM_TIME_WINDOW_ENDED",
        });
      }

      if (exam.status !== "running") exam.status = "running";
      for (const c of exam.classrooms || []) {
      const rid = String(c?.id || c?.name || "").trim();
      if (rid) ensureSeatsForRoom(exam, rid);
      }
      exam.markModified("attendance");


      pushExamTimeline(exam, {
        kind: "EXAM_STARTED",
        at: now,
        roomId: null,
        actor,
        student: null,
        details: { startAt: exam.startAt, endAt: exam.endAt, force: false },
      });

      recalcSummary(exam);

      exam.markModified("report");
      await exam.save();

      return res.json({ ok: true, exam: toOut(exam) });
    }

    // ✅ Force start (demo): reset schedule to now + 3 hours
    const threeHoursMs = 3 * 60 * 60 * 1000;

    exam.startAt = now;
    exam.endAt = new Date(now.getTime() + threeHoursMs);
    exam.status = "running";

    pushExamTimeline(exam, {
      kind: "EXAM_STARTED",
      at: now,
      roomId: null,
      actor,
      student: null,
      details: { startAt: exam.startAt, endAt: exam.endAt, durationHours: 3, force: true },
    });

    for (const c of exam.classrooms || []) {
    const rid = String(c?.id || c?.name || "").trim();
    if (rid) ensureSeatsForRoom(exam, rid);
    }
    exam.markModified("attendance");

    recalcSummary(exam);

    exam.markModified("report");
    await exam.save();

    return res.json({ ok: true, exam: toOut(exam) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to start exam" });
  }
}

export async function endExam(req, res) {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    ensureReport(exam);

    const now = new Date();
    const actor = actorFromReq(req);

    const ws = examWindowState(exam);
    if (!ws.ok) return res.status(400).json({ message: "Invalid exam time window" });

    if (!ws.active) {
      return res.status(400).json({
        message: ws.future ? "EXAM_NOT_STARTED_YET" : "EXAM_TIME_WINDOW_ENDED",
      });
    }

    exam.status = "ended";
    exam.markModified("status");


    pushExamTimeline(exam, {
      kind: "EXAM_ENDED",
      at: now,
      roomId: null,
      actor,
      student: null,
      details: { endedAt: now },
    });

    recalcSummary(exam);

    exam.markModified("report");
    await exam.save();

    return res.json({ ok: true, exam: toOut(exam) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to end exam" });
  }
}

// ✅ POST /api/exams
export async function createExam(req, res) {
  try {
    const me = req.user || {};
    if (String(me.role || "") !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const body = req.body || {};

    const courseName = String(body.courseName || "").trim();
    const examMode = String(body.examMode || "onsite").trim();
    const startAt = new Date(body.startAt || body.examDate || 0);
    const endAt = new Date(body.endAt || 0);

    if (!courseName) return res.status(400).json({ message: "Course name is required." });
    if (Number.isNaN(startAt.getTime())) return res.status(400).json({ message: "Invalid startAt." });
    if (Number.isNaN(endAt.getTime())) return res.status(400).json({ message: "Invalid endAt." });
    if (endAt.getTime() <= startAt.getTime()) {
      return res.status(400).json({ message: "End time must be after Start time." });
    }

    // classrooms normalization
    const classrooms = Array.isArray(body.classrooms) ? body.classrooms : [];
    const cleanRooms = classrooms
      .map((r) => ({
        id: String(r?.id || r?.name || "").trim(),
        name: String(r?.name || r?.id || "").trim(),
        rows: Number(r?.rows || 5),
        cols: Number(r?.cols || 5),
        assignedSupervisorId: r?.assignedSupervisorId ?? null,
        assignedSupervisorName: r?.assignedSupervisorName ?? "",
      }))
      .filter((r) => r.id);

    // lecturer + supervisors
    const lecturerId = body.lecturerId ? String(body.lecturerId) : null;

    // ✅ Build objects with NAMES (save real names to DB)
    let lecturerObj = undefined;
    if (lecturerId) {
      try {
        lecturerObj = await buildLecturerObject(lecturerId);
      } catch (err) {
        return res.status(400).json({ message: err.message || "Invalid lecturerId" });
      }
    }

    const supervisorsObj = await buildSupervisorsFromClassrooms(cleanRooms);

    // ✅ Optional: coLecturers (if modal sends coLecturers from draft)
    let coLecturersObj = [];
    if (Array.isArray(body.coLecturers)) {
      const ids = body.coLecturers.map((x) => String(x?.id || x)).filter(Boolean);
      if (ids.length) {
        const lecUsers = await User.find({ _id: { $in: ids }, role: "lecturer" })
          .select("fullName")
          .lean();
        const byId = new Map(lecUsers.map((u) => [String(u._id), u]));
        coLecturersObj = body.coLecturers
          .map((x) => ({
            id: String(x?.id || "").trim(),
            name: byId.get(String(x?.id || ""))?.fullName || String(x?.name || ""),
            roomIds: Array.isArray(x?.roomIds) ? x.roomIds : [],
          }))
          .filter((x) => x.id);
      }
    }

    const exam = await Exam.create({
      courseName,
      examMode,
      examDate: startAt,
      startAt,
      endAt,
      status: "scheduled",

      // ✅ Save names to DB
      lecturer: lecturerObj,
      coLecturers: coLecturersObj,

      supervisors: supervisorsObj,
      classrooms: cleanRooms,

      attendance: [], // demo: can be generated later
      events: [],
      messages: [],
      note: "",
      report: { summary: {}, timeline: [], studentFiles: {}, studentStats: {} },
    });

    return res.json({ ok: true, exam: toOut(exam) });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to create exam" });
  }
}
