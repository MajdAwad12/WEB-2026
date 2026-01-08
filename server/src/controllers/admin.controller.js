// ===== file: server/src/controllers/admin.controller.js =====
import User from "../models/User.js";
import Exam from "../models/Exam.js";

function ensureAdmin(req, res) {
  const actor = req.user;
  if (!actor || actor.role !== "admin") {
    res.status(403).json({ message: "Admin only" });
    return false;
  }
  return true;
}

function toDateOrNull(x) {
  if (!x) return null;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pickClassrooms(input) {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((r) => ({
      id: String(r?.id || r?.name || "").trim(),
      name: String(r?.name || r?.id || "").trim(),
      rows: Number(r?.rows || 5),
      cols: Number(r?.cols || 5),
      assignedSupervisorId: r?.assignedSupervisorId || null,
      assignedSupervisorName: String(r?.assignedSupervisorName || ""),
    }))
    .filter((r) => r.id && r.name);
}

/* =========================
   Auto-Assign helpers
========================= */

function overlapRanges(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart || 0).getTime();
  const ae = new Date(aEnd || 0).getTime();
  const bs = new Date(bStart || 0).getTime();
  const be = new Date(bEnd || 0).getTime();
  if (!Number.isFinite(as) || !Number.isFinite(ae) || !Number.isFinite(bs) || !Number.isFinite(be)) return false;
  if (ae <= as || be <= bs) return false;
  return as < be && bs < ae;
}

function seatLabel(r, c) {
  return `R${r}-C${c}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeRoomId(x) {
  return String(x || "").trim();
}

async function findBusySupervisorIds({ startAt, endAt, ignoreExamId }) {
  const start = new Date(startAt || 0);
  const end = new Date(endAt || 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return new Set();

  const q = {
    _id: ignoreExamId ? { $ne: ignoreExamId } : { $exists: true },
    startAt: { $lt: end },
    endAt: { $gt: start },
    status: { $ne: "ended" },
  };

  const exams = await Exam.find(q).select("startAt endAt supervisors").lean();

  const busy = new Set();
  for (const e of exams) {
    if (!overlapRanges(e.startAt, e.endAt, startAt, endAt)) continue;
    for (const s of e.supervisors || []) {
      if (s?.id) busy.add(String(s.id));
    }
  }
  return busy;
}

/* =========================
   Room name generator
========================= */
const ROOM_PREFIXES = ["A", "B", "C", "D", "E", "F", "G", "H", "L"];
function genRoomName(i) {
  const letter = ROOM_PREFIXES[i % ROOM_PREFIXES.length];
  const num = 101 + i * 101; // 101, 202, 303...
  return `${letter}${num}`;
}

function ensureExamWindowFromPayload(body) {
  const startAt = toDateOrNull(body?.startAt) || toDateOrNull(body?.examDate);
  const endAt = toDateOrNull(body?.endAt);
  if (!startAt || !endAt) return null;
  if (endAt.getTime() <= startAt.getTime()) return null;
  return { startAt, endAt };
}

function ensureExamTimeWindow(exam) {
  const startAt = exam?.startAt || exam?.examDate || null;
  const endAt = exam?.endAt || null;
  const s = new Date(startAt || 0);
  const e = new Date(endAt || 0);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e.getTime() <= s.getTime()) return null;
  return { startAt: s, endAt: e };
}

function buildRooms({ count, rows, cols, existingRooms }) {
  const rooms = Array.isArray(existingRooms) ? [...existingRooms] : [];
  const used = new Set(rooms.map((r) => normalizeRoomId(r?.id || r?.name)).filter(Boolean));

  let idx = 0;
  while (rooms.length < count) {
    let id = genRoomName(idx);
    while (used.has(id)) {
      idx += 1;
      id = genRoomName(idx);
    }
    rooms.push({
      id,
      name: id,
      rows,
      cols,
      assignedSupervisorId: null,
      assignedSupervisorName: "",
    });
    used.add(id);
    idx += 1;
  }

  for (const r of rooms) {
    r.rows = rows;
    r.cols = cols;
  }

  return rooms.slice(0, count);
}

async function pickFreeSupervisors({ needed, startAt, endAt, ignoreExamId, allowReuse = false }) {
  const busy = await findBusySupervisorIds({ startAt, endAt, ignoreExamId });

  let supUsers = await User.find({ role: "supervisor" }).select("fullName").sort({ fullName: 1 }).lean();

  const free = supUsers.filter((u) => !busy.has(String(u._id)));

  if (free.length >= needed) {
    return { ok: true, supervisors: free.slice(0, needed), reused: false };
  }

  if (!allowReuse) {
    return {
      ok: false,
      message: `Not enough free supervisors. Needed ${needed}, found ${free.length}.`,
      supervisors: [],
    };
  }

  if (!supUsers.length) {
    return { ok: false, message: "No supervisors found in DB.", supervisors: [] };
  }

  const picked = [];
  for (let i = 0; i < needed; i++) {
    picked.push(supUsers[i % supUsers.length]);
  }

  return { ok: true, supervisors: picked, reused: true };
}

/* =========================
   ✅ Lecturers helpers (1 lecturer per 3 rooms)
========================= */
function chunkBy3(arr) {
  return chunk(arr, 3);
}

async function pickLecturersForRooms({ rooms, preferredMainLecturerId }) {
  const roomIds = (rooms || [])
    .map((r) => String(r?.id || r?.name || "").trim())
    .filter(Boolean);
  const groups = chunkBy3(roomIds); // each group = up to 3 rooms
  const neededLecturers = Math.max(1, groups.length);

  const lecturers = await User.find({ role: "lecturer" }).select("fullName username").sort({ username: 1, fullName: 1 }).lean();

  if (!lecturers.length) {
    return { ok: false, message: "No lecturers found in DB. Seed lecturers first.", main: null, co: [] };
  }

  const used = new Set();
  let main = null;

  if (preferredMainLecturerId) {
    const found = lecturers.find((l) => String(l._id) === String(preferredMainLecturerId));
    if (found) {
      main = found;
      used.add(String(found._id));
    }
  }

  if (!main) {
    main = lecturers[0];
    used.add(String(main._id));
  }

  const remainingNeeded = neededLecturers - 1;
  const others = lecturers.filter((l) => !used.has(String(l._id)));

  if (remainingNeeded > others.length) {
    return {
      ok: false,
      message: `Not enough lecturers. Needed ${neededLecturers}, found ${lecturers.length}. Seed more lecturers.`,
      main: null,
      co: [],
    };
  }

  const co = others.slice(0, remainingNeeded);

  const mainRoomIds = groups[0] || [];
  const coAssignments = co.map((lec, idx) => ({
    lec,
    roomIds: groups[idx + 1] || [],
  }));

  return {
    ok: true,
    neededLecturers,
    main: { id: main._id, name: main.fullName || "", roomIds: mainRoomIds },
    co: coAssignments.map((x) => ({ id: x.lec._id, name: x.lec.fullName || "", roomIds: x.roomIds })),
  };
}

/* =========================
   Users
========================= */
export async function listUsers(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const { role } = req.query;
    const q = {};
    if (role) q.role = String(role);

    const users = await User.find(q).select("fullName username email role studentId assignedRoomId").sort({ role: 1, fullName: 1 }).lean();

    return res.json(
      users.map((u) => ({
        id: String(u._id),
        fullName: u.fullName,
        username: u.username,
        email: u.email,
        role: u.role,
        studentId: u.studentId,
        assignedRoomId: u.assignedRoomId || null,
      }))
    );
  } catch (err) {
    console.error("listUsers error", err);
    return res.status(500).json({ message: "Failed to list users" });
  }
}

/* =========================
   Exams (Admin) - LIST
========================= */
export async function listExams(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const { q, status, mode, from, to } = req.query;

    const filter = {};
    if (status && status !== "all") filter.status = String(status);
    if (mode && mode !== "all") filter.examMode = String(mode);

    const fromD = toDateOrNull(from);
    const toD = toDateOrNull(to);

    if (fromD || toD) {
      const range = {};
      if (fromD) range.$gte = fromD;
      if (toD) range.$lte = toD;
      filter.startAt = range;
    }

    const qq = String(q || "").trim();
    if (qq) {
      filter.$or = [
        { courseName: { $regex: qq, $options: "i" } },
        { "classrooms.name": { $regex: qq, $options: "i" } },
        { "classrooms.id": { $regex: qq, $options: "i" } },
      ];
      if (/^[0-9a-fA-F]{12,24}$/.test(qq)) {
        filter.$or.push({ _id: qq });
      }
    }

    const exams = await Exam.find(filter).sort({ startAt: -1, createdAt: -1 }).lean();

    return res.json({ ok: true, exams });
  } catch (err) {
    console.error("listExams error", err);
    return res.status(500).json({ message: "Failed to list exams" });
  }
}

/* =========================
   Exams (Admin) - UPDATE
========================= */
export async function updateExamAdmin(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const { courseName, examMode, examDate, startAt, endAt, lecturerId, supervisorIds, classrooms, note } = req.body || {};

    if (courseName !== undefined) {
      const cn = String(courseName || "").trim();
      if (!cn) return res.status(400).json({ message: "courseName is required" });
      exam.courseName = cn;
    }

    if (examMode !== undefined) {
      const m = String(examMode || "onsite");
      if (!["onsite", "online"].includes(m)) {
        return res.status(400).json({ message: "Invalid examMode" });
      }
      exam.examMode = m;
    }

    const startD = startAt !== undefined ? toDateOrNull(startAt) : exam.startAt;
    const endD = endAt !== undefined ? toDateOrNull(endAt) : exam.endAt;
    const examDateD = examDate !== undefined ? toDateOrNull(examDate) : exam.examDate;

    if (startAt !== undefined && !startD) return res.status(400).json({ message: "Invalid startAt" });
    if (endAt !== undefined && !endD) return res.status(400).json({ message: "Invalid endAt" });
    if (examDate !== undefined && !examDateD) return res.status(400).json({ message: "Invalid examDate" });

    if (startD && endD && endD.getTime() <= startD.getTime()) {
      return res.status(400).json({ message: "End must be after Start" });
    }

    if (startAt !== undefined) exam.startAt = startD;
    if (endAt !== undefined) exam.endAt = endD;
    if (examDate !== undefined) exam.examDate = examDateD;

    if (note !== undefined) exam.note = String(note || "");

    if (lecturerId !== undefined) {
      const lid = String(lecturerId || "").trim();
      if (!lid) return res.status(400).json({ message: "lecturerId is required" });

      const lec = await User.findById(lid).select("fullName role").lean();
      if (!lec) return res.status(400).json({ message: "Lecturer not found" });
      if (lec.role !== "lecturer") return res.status(400).json({ message: "Selected user is not a lecturer" });

      const existingRoomIds = Array.isArray(exam?.lecturer?.roomIds) ? exam.lecturer.roomIds : [];
      exam.lecturer = { id: lec._id, name: lec.fullName || "", roomIds: existingRoomIds };
    }

    // ✅ Update classrooms first (because supervisors should follow classrooms)
    if (classrooms !== undefined) {
      exam.classrooms = pickClassrooms(classrooms);
    }

    // ✅ Build supervisors from classrooms to keep {id,name,roomId} correct in DB
    // If classrooms not provided but supervisorIds provided, fallback to previous behavior.
    const rooms = Array.isArray(exam.classrooms) ? exam.classrooms : [];

    const pairs = rooms
      .map((r) => ({
        roomId: String(r?.id || r?.name || "").trim(),
        supId: r?.assignedSupervisorId ? String(r.assignedSupervisorId) : "",
        nameHint: String(r?.assignedSupervisorName || "").trim(),
      }))
      .filter((x) => x.roomId && x.supId);

    if (pairs.length) {
      const supUsers = await User.find({ _id: { $in: pairs.map((x) => x.supId) }, role: "supervisor" }).select("fullName").lean();
      const byId = new Map(supUsers.map((u) => [String(u._id), u]));

      exam.supervisors = pairs.map((p) => ({
        id: p.supId,
        name: byId.get(String(p.supId))?.fullName || p.nameHint || "",
        roomId: p.roomId,
      }));
    } else if (supervisorIds !== undefined) {
      const ids = Array.isArray(supervisorIds) ? supervisorIds : [];
      const clean = ids.map((x) => String(x)).filter(Boolean);

      const supUsers = await User.find({ _id: { $in: clean }, role: "supervisor" }).select("fullName").lean();
      const byId = new Map(supUsers.map((u) => [String(u._id), u]));

      exam.supervisors = clean
        .filter((id) => byId.has(String(id)))
        .map((id) => {
          const u = byId.get(String(id));
          return { id: u._id, name: u.fullName || "", roomId: "" };
        });
    }

    // keep your existing status logic
    const nowMs = Date.now();
    const sMs = new Date(exam.startAt || exam.examDate || 0).getTime();
    const eMs = new Date(exam.endAt || 0).getTime();

    const validWindow = Number.isFinite(sMs) && Number.isFinite(eMs) && sMs > 0 && eMs > 0 && eMs > sMs;

    if (validWindow) {
      const isFuture = nowMs < sMs;
      const isActive = nowMs >= sMs && nowMs <= eMs;
      const isPast = nowMs > eMs;

      if (isFuture) {
        exam.status = "scheduled";
      } else if (isActive) {
        if (String(exam.status || "").toLowerCase() !== "running") {
          exam.status = "scheduled";
        }
      } else if (isPast) {
        // keep ended as ended
      }
    }

    await exam.save();
    return res.json({ ok: true, exam });
  } catch (err) {
    console.error("updateExamAdmin error", err);
    return res.status(500).json({ message: "Failed to update exam" });
  }
}

/* =========================
   Exams (Admin) - DELETE
========================= */
export async function deleteExamAdmin(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const { examId } = req.params;

    const exam = await Exam.findById(examId).select("_id status").lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    if (String(exam.status) === "running") {
      return res.status(400).json({ message: "Cannot delete a running exam. End it first." });
    }

    await Exam.deleteOne({ _id: examId });
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteExamAdmin error", err);
    return res.status(500).json({ message: "Failed to delete exam" });
  }
}

/* =========================
   ✅ Draft Auto-Assign (Create Modal)
   POST /api/admin/exams/auto-assign-draft
   - Does NOT save anything
========================= */
export async function autoAssignDraft(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const win = ensureExamWindowFromPayload(req.body || {});
    if (!win) return res.status(400).json({ message: "Invalid time window (startAt/endAt)" });

    const totalStudents = Math.max(0, Number(req.body?.totalStudents || 0));

    // ✅ requestedRooms can be 0 => AUTO
    const requestedRooms = Math.max(0, Number(req.body?.requestedRooms || 0));

    const ROWS = 5;
    const COLS = 5;
    const CAP = ROWS * COLS; // 25

    const neededByStudents = totalStudents > 0 ? Math.max(1, Math.ceil(totalStudents / CAP)) : 0;

    // ✅ If requestedRooms=0, this becomes "students-based" (or 1 minimum)
    const neededRooms = Math.max(requestedRooms, neededByStudents, 1);

    const rooms = buildRooms({ count: neededRooms, rows: ROWS, cols: COLS, existingRooms: [] });

    const pick = await pickFreeSupervisors({
      needed: neededRooms,
      startAt: win.startAt,
      endAt: win.endAt,
      ignoreExamId: null,
      allowReuse: false,
    });

    if (!pick.ok) return res.status(400).json({ message: pick.message });

    for (let i = 0; i < rooms.length; i++) {
      const sup = pick.supervisors[i];
      rooms[i].assignedSupervisorId = sup._id;
      rooms[i].assignedSupervisorName = sup.fullName || "";
    }

    const supervisorsDraft = rooms.map((r) => ({
      id: r.assignedSupervisorId,
      name: r.assignedSupervisorName,
      roomId: r.id,
    }));

    const lecDraft = await pickLecturersForRooms({ rooms, preferredMainLecturerId: null });
    if (!lecDraft.ok) return res.status(400).json({ message: lecDraft.message });

    return res.json({
      ok: true,
      draft: {
        classrooms: rooms,
        supervisors: supervisorsDraft,
        lecturer: lecDraft.main,
        coLecturers: lecDraft.co,
        meta: {
          totalStudents,
          roomsCapacity: CAP,
          roomsUsed: neededRooms,
          lecturersUsed: lecDraft.neededLecturers,
        },
      },
    });
  } catch (err) {
    console.error("autoAssignDraft error", err);
    return res.status(500).json({ message: "Failed to auto-assign draft" });
  }
}

/* =========================
   Auto-Assign (existing)
   POST /api/admin/exams/:examId/auto-assign
========================= */
export async function autoAssignExam(req, res) {
  try {
    if (!ensureAdmin(req, res)) return;

    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const win = ensureExamTimeWindow(exam);
    if (!win) return res.status(400).json({ message: "Invalid exam time window (startAt/endAt)" });

    let attendance = Array.isArray(exam.attendance) ? exam.attendance : [];

    if (!attendance.length) {
      const students = await User.find({ role: "student" }).select("fullName studentId").sort({ fullName: 1 }).lean();

      attendance = students.map((u) => ({
        studentId: u._id,
        name: u.fullName || "",
        studentNumber: u.studentId || "",
        classroom: "",
        roomId: "",
        seat: "",
        status: "not_arrived",
        arrivedAt: null,
        outStartedAt: null,
        finishedAt: null,
        lastStatusAt: null,
        violations: 0,
      }));

      exam.attendance = attendance;
    }

    const totalStudents = attendance.length;

    const ROWS = 5;
    const COLS = 5;
    const CAP = ROWS * COLS; // 25

    const neededRooms = Math.max(1, Math.ceil(totalStudents / CAP));

    const rooms = buildRooms({
      count: neededRooms,
      rows: ROWS,
      cols: COLS,
      existingRooms: Array.isArray(exam.classrooms) ? exam.classrooms : [],
    });

    const pick = await pickFreeSupervisors({
      needed: neededRooms,
      startAt: win.startAt,
      endAt: win.endAt,
      ignoreExamId: exam._id,
    });

    if (!pick.ok) return res.status(400).json({ message: pick.message });

    const assignedSupIds = [];
    for (let i = 0; i < neededRooms; i++) {
      const room = rooms[i];
      const supUser = pick.supervisors[i];

      room.assignedSupervisorId = supUser._id;
      room.assignedSupervisorName = supUser.fullName || "";
      assignedSupIds.push(String(supUser._id));
    }

    exam.classrooms = rooms;

    exam.supervisors = pick.supervisors.map((u, idx) => ({
      id: u._id,
      name: u.fullName || "",
      roomId: rooms[idx]?.id || "",
    }));

    const preferredMainId = exam?.lecturer?.id ? String(exam.lecturer.id) : null;
    const lecPick = await pickLecturersForRooms({ rooms, preferredMainLecturerId: preferredMainId });
    if (!lecPick.ok) return res.status(400).json({ message: lecPick.message });

    exam.lecturer = lecPick.main;
    exam.coLecturers = lecPick.co;

    const groups = chunk(attendance, CAP);

    for (let g = 0; g < groups.length; g++) {
      const room = rooms[g];
      const roomId = String(room.id || room.name || "").trim();

      let idx2 = 0;
      for (let r = 1; r <= ROWS; r++) {
        for (let c = 1; c <= COLS; c++) {
          const att = groups[g][idx2];
          if (!att) break;

          att.classroom = roomId;
          att.roomId = roomId;
          att.seat = seatLabel(r, c);

          idx2 += 1;
        }
      }
    }

    exam.markModified("classrooms");
    exam.markModified("supervisors");
    exam.markModified("attendance");
    exam.markModified("lecturer");
    exam.markModified("coLecturers");

    await exam.save();

    return res.json({
      ok: true,
      exam,
      meta: {
        totalStudents,
        roomsUsed: neededRooms,
        supervisorsAssigned: assignedSupIds.length,
        supervisorsCreated: 0,
        lecturersUsed: lecPick.neededLecturers,
      },
    });
  } catch (err) {
    console.error("autoAssignExam error", err);
    return res.status(500).json({ message: "Failed to auto-assign exam" });
  }
}
