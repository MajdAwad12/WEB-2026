// ===== file: server/src/controllers/transfers.controller.js =====
import TransferRequest from "../models/TransferRequest.js";
import Exam from "../models/Exam.js";

/* =========================
   Helpers
========================= */
function normalizeRoomId(v) {
  return String(v || "").trim();
}
function roleOf(user) {
  return String(user?.role || "").toLowerCase();
}
function isLecturerOrAdmin(user) {
  const r = roleOf(user);
  return r === "lecturer" || r === "admin";
}
function isSupervisor(user) {
  return roleOf(user) === "supervisor";
}
function actorOf(user) {
  return { id: user?._id, name: user?.fullName || user?.username || "", role: roleOf(user) };
}

function deriveSupervisorRoomId({ user, exam }) {
  const fromUser = normalizeRoomId(user?.assignedRoomId);
  if (fromUser) return fromUser;

  const sup = (exam?.supervisors || []).find((s) => String(s?.id) === String(user?._id));
  const fromExamSupervisor = normalizeRoomId(sup?.roomId);
  if (fromExamSupervisor) return fromExamSupervisor;

  const cls = (exam?.classrooms || []).find(
    (c) => String(c?.assignedSupervisorId) === String(user?._id)
  );
  const fromClassrooms = normalizeRoomId(cls?.id || cls?.name);
  if (fromClassrooms) return fromClassrooms;

  return "";
}

/* =========================
   Report helpers (timeline)
========================= */
function ensureReport(exam) {
  if (!exam.report) exam.report = {};
  if (!exam.report.summary) exam.report.summary = {};
  if (!Array.isArray(exam.report.timeline)) exam.report.timeline = [];
}
function pushTimeline(exam, payload) {
  ensureReport(exam);
  exam.report.timeline.push(payload);
}

/* =========================
   Events helpers (Exam.events schema from Exam.js)
   eventSchema: { type, timestamp, description, severity, classroom, seat, studentId }
========================= */
function ensureEvents(exam) {
  if (!Array.isArray(exam.events)) exam.events = [];
}
function pushEvent(exam, { type, timestamp, description, severity, classroom, seat, studentId }) {
  ensureEvents(exam);
  exam.events.push({
    type: String(type || ""),
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    description: String(description || ""),
    severity: String(severity || "low"),
    classroom: String(classroom || ""),
    seat: String(seat || ""),
    studentId: studentId || null,
  });
}

/* =========================
   Seat / room helpers
========================= */
function isOccupyingStatus(status) {
  const s = String(status || "").toLowerCase();
  // ✅ finished still occupies its seat (do not reuse seats)
  return ["present", "temp_out", "moving", "finished", "absent", "not_arrived"].includes(s);
}


function findClassroom(exam, roomId) {
  const rid = normalizeRoomId(roomId);
  if (!rid) return null;

  // match by classroom.id first, then by name
  const byId = (exam?.classrooms || []).find((c) => normalizeRoomId(c?.id) === rid);
  if (byId) return byId;

  const byName = (exam?.classrooms || []).find((c) => normalizeRoomId(c?.name) === rid);
  if (byName) return byName;

  return null;
}

function canonicalRoomId(exam, roomId) {
  const c = findClassroom(exam, roomId);
  return normalizeRoomId(c?.id || c?.name || roomId);
}

function roomDims(exam, roomId) {
  const c = findClassroom(exam, roomId);
  return {
    rows: Math.max(0, Number(c?.rows || 0)),
    cols: Math.max(0, Number(c?.cols || 0)),
  };
}

function roomCapacity(exam, roomId) {
  const { rows, cols } = roomDims(exam, roomId);
  return rows * cols;
}

function seatLabel(r, c) {
  return `R${r}-C${c}`;
}

function isSeatLabelValid(exam, roomId, seat) {
  const s = String(seat || "").trim().toUpperCase();
  if (!s) return false;
  const { rows, cols } = roomDims(exam, roomId);
  if (rows <= 0 || cols <= 0) return false;

  // format: Rn-Cm
  const m = /^R(\d+)-C(\d+)$/i.exec(s);
  if (!m) return false;
  const r = Number(m[1]);
  const c = Number(m[2]);
  return r >= 1 && r <= rows && c >= 1 && c <= cols;
}

function roomOccupiedCount(exam, roomId) {
  const rid = canonicalRoomId(exam, roomId);
  const list = exam?.attendance || [];
  let occupied = 0;

  for (const a of list) {
    const ar = canonicalRoomId(exam, a?.classroom || "");
    if (ar !== rid) continue;
    if (!isOccupyingStatus(a.status)) continue;
    occupied += 1;
  }
  return occupied;
}

function roomHasFreeSeat(exam, roomId) {
  const cap = roomCapacity(exam, roomId);
  if (cap <= 0) return false;
  const occupied = roomOccupiedCount(exam, roomId);
  return occupied < cap;
}

function usedSeatsSet(exam, roomId) {
  const rid = canonicalRoomId(exam, roomId);
  const set = new Set();
  for (const a of exam?.attendance || []) {
    const ar = canonicalRoomId(exam, a?.classroom || "");
    if (ar !== rid) continue;
    if (!isOccupyingStatus(a.status)) continue;
    const s = String(a.seat || "").trim().toUpperCase();
    if (s) set.add(s);
  }
  return set;
}

function findFirstFreeSeat(exam, roomId) {
  const rid = canonicalRoomId(exam, roomId);
  const { rows, cols } = roomDims(exam, rid);
  if (rows <= 0 || cols <= 0) return "";

  const used = usedSeatsSet(exam, rid);

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const label = seatLabel(r, c);
      if (!used.has(label)) return label;
    }
  }
  return "";
}

function isSeatTaken(exam, roomId, seat) {
  const rid = canonicalRoomId(exam, roomId);
  const s = String(seat || "").trim().toUpperCase();
  if (!s) return false;

  const used = usedSeatsSet(exam, rid);
  return used.has(s);
}

function normalizeSeat(seat) {
  const s = String(seat || "").trim().toUpperCase();
  return s || "AUTO";
}

function examHasRoom(exam, roomId) {
  return Boolean(findClassroom(exam, roomId));
}

/* =========================
   Permissions
========================= */
function canCancelTransfer(user, tr, exam) {
  if (!user || !tr) return false;

  const r = roleOf(user);
  if (r === "admin" || r === "lecturer") return true;

  // requester can cancel
  if (String(tr.requestedBy?.id || "") === String(user._id || "")) return true;

  // supervisor of FROM room can cancel (realistic)
  if (r === "supervisor" && exam) {
    const myRoom = deriveSupervisorRoomId({ user, exam });
    if (myRoom && canonicalRoomId(exam, myRoom) === canonicalRoomId(exam, tr.fromClassroom)) return true;
  }

  return false;
}

/* =========================
   GET /api/transfers?examId=...
========================= */
export async function listTransfers(req, res) {
  try {
    const examId = String(req.query.examId || "").trim();
    if (!examId) return res.status(400).json({ message: "examId is required" });

    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const filter = { examId };

    if (isSupervisor(user)) {
      const exam = await Exam.findById(examId).lean();
      if (!exam) return res.status(404).json({ message: "Exam not found" });

      const myRoom = deriveSupervisorRoomId({ user, exam });
      if (!myRoom) return res.status(403).json({ message: "Supervisor has no assigned room" });

      filter.$or = [{ toClassroom: myRoom }, { fromClassroom: myRoom }];
    }

    const items = await TransferRequest.find(filter).sort({ createdAt: -1 }).limit(80).lean();
    return res.json({ items });
  } catch (err) {
    console.error("listTransfers:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   POST /api/transfers
   ✅ do NOT change attendance on request.
========================= */
export async function createTransfer(req, res) {
  try {
    const { examId, studentId, toClassroom, toSeat, note, reasonCode } = req.body || {};
    const eid = String(examId || "").trim();
    const sid = String(studentId || "").trim();
    const targetRoomRaw = normalizeRoomId(toClassroom);

    if (!eid || !sid || !targetRoomRaw) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const exam = await Exam.findById(eid);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    if (!examHasRoom(exam, targetRoomRaw)) {
      return res.status(400).json({ message: "Target classroom is not part of this exam" });
    }

    const targetRoom = canonicalRoomId(exam, targetRoomRaw);

    const att = (exam.attendance || []).find((a) => String(a.studentId) === sid);
    if (!att) return res.status(404).json({ message: "Student not found in attendance" });

    const fromClassroom = canonicalRoomId(exam, att.classroom || "");
    const fromSeat = String(att.seat || "").trim();

    let myRoom = "";
    if (isSupervisor(user)) {
      myRoom = deriveSupervisorRoomId({ user, exam });
      if (!myRoom) return res.status(403).json({ message: "Supervisor has no assigned room" });

      if (canonicalRoomId(exam, myRoom) !== fromClassroom) {
        return res.status(403).json({ message: "Forbidden: you can transfer only from your room" });
      }
    }

    if (String(att.status || "").toLowerCase() === "finished") {
      return res.status(400).json({ message: "Cannot transfer a finished student" });
    }

    const seatNorm = normalizeSeat(toSeat || "AUTO");

    // if user asked specific seat -> validate format and availability early
    if (seatNorm !== "AUTO") {
      if (!isSeatLabelValid(exam, targetRoom, seatNorm)) {
        return res.status(400).json({ message: "Invalid seat label for target classroom" });
      }
      if (isSeatTaken(exam, targetRoom, seatNorm)) {
        return res.status(409).json({ message: "SEAT_TAKEN" });
      }
    }

    const existingPending = await TransferRequest.findOne({
      examId: eid,
      studentId: sid,
      status: "pending",
    }).lean();

    if (existingPending) {
      return res.status(400).json({ message: "There is already a pending transfer for this student" });
    }

    const created = await TransferRequest.create({
      examId: eid,
      studentId: sid,
      studentName: att.name || "",
      studentCode: att.studentNumber || "",

      fromClassroom,
      fromSeat,

      toClassroom: targetRoom,
      toSeat: seatNorm,

      prevStatus: String(att.status || ""),
      prevClassroom: fromClassroom,
      prevSeat: fromSeat,

      seat: fromSeat, // legacy

      requestedBy: {
        id: user._id,
        name: user.fullName || user.username,
        role: roleOf(user),
        roomId: canonicalRoomId(exam, myRoom || fromClassroom || ""),
      },

      reasonCode: String(reasonCode || "").slice(0, 50),
      note: String(note || "").slice(0, 300),
    });

    pushTimeline(exam, {
      kind: "TRANSFER_REQUEST",
      at: new Date(),
      roomId: fromClassroom,
      actor: actorOf(user),
      student: { id: att.studentId, name: att.name || "", code: att.studentNumber || "", seat: fromSeat, classroom: fromClassroom },
      details: { toClassroom: targetRoom, toSeat: seatNorm, requestId: String(created._id), note: created.note, reasonCode: created.reasonCode || "" },
    });

    await exam.save();
    return res.status(201).json({ item: created });
  } catch (err) {
    console.error("createTransfer:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   POST /api/transfers/:id/approve
   ✅ server validates capacity now:
   - room full -> keep pending + lastError ROOM_FULL + exam event + 409
========================= */
export async function approveTransfer(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const tr = await TransferRequest.findById(id);
    if (!tr) return res.status(404).json({ message: "Transfer not found" });
    if (tr.status !== "pending") return res.status(400).json({ message: "Transfer already handled" });

    if (isLecturerOrAdmin(user)) return res.status(403).json({ message: "Lecturer/Admin cannot approve transfers (view-only)" });
    if (!isSupervisor(user)) return res.status(403).json({ message: "Only supervisors can approve transfers" });

    const exam = await Exam.findById(tr.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const myRoom = deriveSupervisorRoomId({ user, exam });
    if (!myRoom || canonicalRoomId(exam, myRoom) !== canonicalRoomId(exam, tr.toClassroom)) {
      return res.status(403).json({ message: "Forbidden: not your room transfer" });
    }

    const targetRoom = canonicalRoomId(exam, tr.toClassroom);

    // ✅ CAPACITY CHECK (real)
    if (!roomHasFreeSeat(exam, targetRoom)) {
      tr.lastError = "ROOM_FULL";
      tr.lastErrorAt = new Date();
      await tr.save();

      pushEvent(exam, {
        type: "TRANSFER_ROOM_FULL",
        timestamp: new Date(),
        description: `Cannot approve transfer: room ${targetRoom} is full`,
        severity: "medium",
        classroom: targetRoom,
        seat: "",
        studentId: tr.studentId ? tr.studentId : null,
      });

      exam.markModified("events");
      await exam.save();

      return res.status(409).json({ message: "ROOM_FULL", item: tr });
    }

    const att = (exam.attendance || []).find((a) => String(a.studentId) === String(tr.studentId));
    if (!att) return res.status(404).json({ message: "Student not found in attendance" });

    const from = {
      classroom: canonicalRoomId(exam, att.classroom || ""),
      seat: String(att.seat || "").trim(),
      status: String(att.status || ""),
    };

    // ✅ seat selection
    const requestedSeat = normalizeSeat(tr.toSeat || "AUTO");
    let finalSeat = "";

    if (requestedSeat === "AUTO") {
      finalSeat = findFirstFreeSeat(exam, targetRoom);
    } else {
      // validate requested seat fits the target classroom
      if (!isSeatLabelValid(exam, targetRoom, requestedSeat)) {
        return res.status(400).json({ message: "Invalid seat label for target classroom" });
      }
      finalSeat = isSeatTaken(exam, targetRoom, requestedSeat)
        ? findFirstFreeSeat(exam, targetRoom)
        : requestedSeat;
    }

    // Edge-case: capacity said yes but cannot allocate seat => treat as full
    if (!finalSeat) {
      tr.lastError = "ROOM_FULL";
      tr.lastErrorAt = new Date();
      await tr.save();

      pushEvent(exam, {
        type: "TRANSFER_ROOM_FULL",
        timestamp: new Date(),
        description: `Cannot approve transfer: room ${targetRoom} has no available seat`,
        severity: "medium",
        classroom: targetRoom,
        seat: "",
        studentId: tr.studentId ? tr.studentId : null,
      });

      exam.markModified("events");
      await exam.save();

      return res.status(409).json({ message: "ROOM_FULL", item: tr });
    }

    att.classroom = targetRoom;
    att.roomId = targetRoom;   // ✅ חשוב!
    att.seat = finalSeat;


    // ensure not_arrived doesn't stay after move
    if (String(att.status || "").toLowerCase() === "not_arrived") att.status = "present";
    att.lastStatusAt = new Date();

    pushTimeline(exam, {
      kind: "TRANSFER_APPROVED",
      at: new Date(),
      roomId: targetRoom,
      actor: actorOf(user),
      student: { id: att.studentId, name: att.name || "", code: att.studentNumber || "", seat: att.seat || "", classroom: att.classroom || "" },
      details: { from, to: { classroom: targetRoom, seat: finalSeat }, requestId: String(tr._id) },
    });

    pushEvent(exam, {
      type: "TRANSFER_APPROVED",
      timestamp: new Date(),
      description: `Transfer approved to ${targetRoom} seat ${finalSeat}`,
      severity: "low",
      classroom: targetRoom,
      seat: finalSeat,
      studentId: att.studentId || null,
    });

    exam.markModified("events");
    exam.markModified("attendance");
    await exam.save();

    tr.status = "approved";
    tr.lastError = "";
    tr.lastErrorAt = null;
    tr.handledBy = { id: user._id, name: user.fullName || user.username, roomId: canonicalRoomId(exam, myRoom) };
    tr.toSeat = finalSeat;
    await tr.save();

    return res.json({ item: tr });
  } catch (err) {
    console.error("approveTransfer:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   POST /api/transfers/:id/reject
   ✅ Reject does NOT touch attendance.
========================= */
export async function rejectTransfer(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const tr = await TransferRequest.findById(id);
    if (!tr) return res.status(404).json({ message: "Transfer not found" });
    if (tr.status !== "pending") return res.status(400).json({ message: "Transfer already handled" });

    if (isLecturerOrAdmin(user)) return res.status(403).json({ message: "Lecturer/Admin cannot reject transfers (view-only)" });
    if (!isSupervisor(user)) return res.status(403).json({ message: "Only supervisors can reject transfers" });

    const exam = await Exam.findById(tr.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const myRoom = deriveSupervisorRoomId({ user, exam });
    if (!myRoom || canonicalRoomId(exam, myRoom) !== canonicalRoomId(exam, tr.toClassroom)) {
      return res.status(403).json({ message: "Forbidden: not your room transfer" });
    }

    tr.status = "rejected";
    tr.lastError = "";
    tr.lastErrorAt = null;
    tr.handledBy = { id: user._id, name: user.fullName || user.username, roomId: canonicalRoomId(exam, myRoom) };
    await tr.save();

    pushTimeline(exam, {
      kind: "TRANSFER_REJECTED",
      at: new Date(),
      roomId: canonicalRoomId(exam, tr.toClassroom || tr.fromClassroom || ""),
      actor: actorOf(user),
      student: { id: tr.studentId || null, name: tr.studentName || "", code: tr.studentCode || "", seat: tr.fromSeat || tr.seat || "", classroom: tr.fromClassroom || "" },
      details: { requestId: String(tr._id), toClassroom: canonicalRoomId(exam, tr.toClassroom), toSeat: String(tr.toSeat || "").trim(), note: tr.note || "" },
    });

    pushEvent(exam, {
      type: "TRANSFER_REJECTED",
      timestamp: new Date(),
      description: `Transfer rejected`,
      severity: "low",
      classroom: canonicalRoomId(exam, tr.toClassroom || tr.fromClassroom || ""),
      seat: "",
      studentId: tr.studentId ? tr.studentId : null,
    });

    exam.markModified("events");
    await exam.save();

    return res.json({ item: tr });
  } catch (err) {
    console.error("rejectTransfer:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   POST /api/transfers/:id/cancel
   ✅ Cancel keeps attendance unchanged
========================= */
export async function cancelTransfer(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const tr = await TransferRequest.findById(id);
    if (!tr) return res.status(404).json({ message: "Transfer not found" });
    if (tr.status !== "pending") return res.status(400).json({ message: "Only pending transfers can be cancelled" });

    const exam = await Exam.findById(tr.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    if (!canCancelTransfer(user, tr, exam)) {
      return res.status(403).json({ message: "Forbidden: cannot cancel this transfer" });
    }

    tr.status = "cancelled";
    tr.lastError = "";
    tr.lastErrorAt = null;
    tr.handledBy = { id: user._id, name: user.fullName || user.username, roomId: canonicalRoomId(exam, user.assignedRoomId || "") };
    await tr.save();

    pushTimeline(exam, {
      kind: "TRANSFER_CANCELLED",
      at: new Date(),
      roomId: canonicalRoomId(exam, tr.fromClassroom || ""),
      actor: actorOf(user),
      student: { id: tr.studentId || null, name: tr.studentName || "", code: tr.studentCode || "", seat: tr.fromSeat || tr.seat || "", classroom: tr.fromClassroom || "" },
      details: { requestId: String(tr._id), toClassroom: canonicalRoomId(exam, tr.toClassroom), toSeat: String(tr.toSeat || "").trim(), note: tr.note || "" },
    });

    pushEvent(exam, {
      type: "TRANSFER_CANCELLED",
      timestamp: new Date(),
      description: `Transfer cancelled`,
      severity: "low",
      classroom: canonicalRoomId(exam, tr.fromClassroom || ""),
      seat: "",
      studentId: tr.studentId ? tr.studentId : null,
    });

    exam.markModified("events");
    await exam.save();

    return res.json({ item: tr });
  } catch (err) {
    console.error("cancelTransfer:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
