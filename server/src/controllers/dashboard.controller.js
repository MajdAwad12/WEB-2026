// ===== file: server/src/controllers/dashboard.controller.js =====
import Exam from "../models/Exam.js";
import User from "../models/User.js";
import TransferRequest from "../models/TransferRequest.js";

function isRecipient(msg, user) {
  const uid = String(user._id);
  const toUserIds = (msg.toUserIds || []).map(String);
  const toRoles = msg.toRoles || [];
  if (toUserIds.includes(uid)) return true;
  if (toRoles.includes(user.role)) return true;
  return false;
}

async function findRunningExamForUser(user) {
  if (String(user.role).toLowerCase() === "admin") {
    return Exam.findOne({ status: "running" }).sort({ startAt: 1 });
  }

  const examQuery = { status: "running" };

  if (user.role === "lecturer") {
    examQuery["$or"] = [{ "lecturer.id": user._id }, { "coLecturers.id": user._id }];
  }

  if (user.role === "supervisor") {
    examQuery["supervisors.id"] = user._id;
  }

  return Exam.findOne(examQuery).sort({ startAt: 1 });
}

function normalizeRoomId(v) {
  return String(v || "").trim();
}

// ✅ IMPORTANT: attendance room can be in classroom OR roomId
function attRoom(a) {
  return normalizeRoomId(a?.classroom || a?.roomId);
}

/**
 * deriveSupervisorRoomId
 */
function deriveSupervisorRoomId({ user, exam }) {
  const fromUser = normalizeRoomId(user?.assignedRoomId);
  if (fromUser) return fromUser;

  const sup = (exam?.supervisors || []).find((s) => String(s?.id) === String(user?._id));
  const fromExamSupervisor = normalizeRoomId(sup?.roomId);
  if (fromExamSupervisor) return fromExamSupervisor;

  const cls = (exam?.classrooms || []).find(
    (c) => String(c?.assignedSupervisorId) === String(user?._id)
  );
  const fromClassrooms = normalizeRoomId(cls?.id || cls?.roomId || cls?.name);
  if (fromClassrooms) return fromClassrooms;

  return "";
}

export async function getClock(req, res) {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const exam = await findRunningExamForUser(user);
    return res.json({
      simNow: new Date().toISOString(),
      simExamId: exam ? String(exam._id) : null,
      speed: 1,
    });
  } catch (err) {
    console.error("getClock error", err);
    return res.status(500).json({ message: "clock_error" });
  }
}

export async function getDashboardSnapshot(req, res) {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const exam = await findRunningExamForUser(user);

    if (!exam) {
      return res.json({
        me: {
          id: String(user._id),
          role: user.role,
          username: user.username,
          fullName: user.fullName,
          assignedRoomId: user.assignedRoomId || null,
        },
        exam: null,
        attendance: [],
        transfers: [],
        stats: {},
        alerts: [],
        inbox: { unread: 0, recent: [] },
        events: [],
        reportStudentStats: {},
        reportStudentFiles: {},
      });
    }

    const role = String(user.role || "").toLowerCase();
    const isSupervisor = role === "supervisor";
    const isLecturerLike = role === "lecturer" || role === "admin";

    const myRoomId = isSupervisor ? deriveSupervisorRoomId({ user, exam }) : "";

    // ---------------- Attendance visibility ----------------
    const allAttendance = exam.attendance || [];

    const visibleAttendance =
      isSupervisor && myRoomId
        ? allAttendance.filter((a) => attRoom(a) === normalizeRoomId(myRoomId))
        : allAttendance;

    // ---------------- studentStats map -> plain object ----------------
    const reportStatsMap = exam.report?.studentStats || new Map();
    const studentStats = {};
    if (reportStatsMap?.forEach) {
      reportStatsMap.forEach((val, key) => {
        studentStats[String(key)] = val;
      });
    } else if (reportStatsMap && typeof reportStatsMap === "object") {
      Object.assign(studentStats, reportStatsMap);
    }

    // ---------------- studentFiles map -> plain object ----------------
    const reportFilesMap = exam.report?.studentFiles || new Map();
    const studentFiles = {};
    if (reportFilesMap?.forEach) {
      reportFilesMap.forEach((val, key) => {
        studentFiles[String(key)] = val;
      });
    } else if (reportFilesMap && typeof reportFilesMap === "object") {
      Object.assign(studentFiles, reportFilesMap);
    }

    // ---------------- Stats ----------------
    const stats = {
      totalStudents: visibleAttendance.length,
      present: visibleAttendance.filter((a) => a.status === "present").length,
      tempOut: visibleAttendance.filter((a) => a.status === "temp_out").length,
      absent: visibleAttendance.filter((a) => a.status === "absent").length,
      moving: visibleAttendance.filter((a) => a.status === "moving").length,
      finished: visibleAttendance.filter((a) => a.status === "finished").length,
      notArrived: visibleAttendance.filter((a) => a.status === "not_arrived").length,
      violations: visibleAttendance.reduce((sum, a) => sum + (a.violations || 0), 0),
    };

    const alerts = [];
    const now = Date.now();

    // ---------------- Toilet too long ----------------
    const TOILET_ALERT_MS = 10 * 60 * 1000;
    for (const a of visibleAttendance) {
      if (a.status !== "temp_out") continue;

      const key = String(a.studentId);
      const st = studentFiles[key];

      const leftAt = st?.activeToilet?.leftAt ? new Date(st.activeToilet.leftAt).getTime() : null;
      const startedAt = a.outStartedAt ? new Date(a.outStartedAt).getTime() : null;

      const base = leftAt || startedAt;
      if (!base) continue;

      const elapsedMs = Math.max(0, now - base);
      if (elapsedMs >= TOILET_ALERT_MS) {
        alerts.push({
          type: "TOILET_LONG",
          severity: "medium",
          at: new Date(base).toISOString(),
          roomId: attRoom(a),
          studentId: key,
          studentCode: a.studentNumber || "",
          name: a.name || "",
          classroom: attRoom(a),
          seat: a.seat || "",
          elapsedMs,
        });
      }
    }

    // ---------------- Messages inbox ----------------
    const msgItems = (exam.messages || [])
      .filter((m) => isRecipient(m, user) || String(m.from?.id) === String(user._id))
      .slice(-30);

    const unread = msgItems.filter((m) => !(m.readBy || []).map(String).includes(String(user._id))).length;
    const recentMessages = msgItems.slice(-10).reverse();

    for (const m of msgItems.slice(-20)) {
      const isUnread = !(m.readBy || []).map(String).includes(String(user._id));
      if (!isUnread) continue;
      if (!isRecipient(m, user)) continue;

      if (isSupervisor && myRoomId && m.roomId && normalizeRoomId(m.roomId) !== normalizeRoomId(myRoomId)) continue;

      alerts.push({
        type: "MESSAGE",
        severity: "low",
        at: m.at || new Date().toISOString(),
        from: m.from || {},
        roomId: m.roomId || "",
        text: m.text || "",
      });
    }

    // ---------------- Transfers ----------------
    const allTransfers = await TransferRequest.find({ examId: exam._id })
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const transfers =
      isSupervisor && myRoomId
        ? allTransfers.filter(
            (t) =>
              normalizeRoomId(t.toClassroom) === normalizeRoomId(myRoomId) ||
              normalizeRoomId(t.fromClassroom) === normalizeRoomId(myRoomId)
          )
        : allTransfers;

    const pending = allTransfers.filter((t) => t.status === "pending");

    for (const t of pending) {
      if (isSupervisor && myRoomId && normalizeRoomId(t.toClassroom) === normalizeRoomId(myRoomId)) {
        alerts.push({
          type: "TRANSFER_PENDING_TO_YOU",
          severity: "medium",
          at: t.createdAt,
          roomId: t.toClassroom,
          studentId: String(t.studentId),
          studentCode: t.studentCode || "",
          studentName: t.studentName || "",
          fromClassroom: t.fromClassroom,
          toClassroom: t.toClassroom,
          requestId: String(t._id),
        });
      }

      if (isLecturerLike) {
        alerts.push({
          type: "TRANSFER_PENDING_IN_EXAM",
          severity: "low",
          at: t.createdAt,
          roomId: t.toClassroom,
          studentId: String(t.studentId),
          studentCode: t.studentCode || "",
          studentName: t.studentName || "",
          fromClassroom: t.fromClassroom,
          toClassroom: t.toClassroom,
          requestId: String(t._id),
        });
      }
    }

    // ✅ NEW: ROOM FULL alerts (pending stays pending)
    for (const t of pending) {
      if (String(t.lastError || "") !== "ROOM_FULL") continue;

      const at = t.lastErrorAt || t.updatedAt || t.createdAt;

      // notify target supervisor
      if (isSupervisor && myRoomId && normalizeRoomId(t.toClassroom) === normalizeRoomId(myRoomId)) {
        alerts.push({
          type: "TRANSFER_ROOM_FULL",
          severity: "medium",
          at,
          roomId: t.toClassroom,
          studentId: String(t.studentId),
          studentCode: t.studentCode || "",
          studentName: t.studentName || "",
          fromClassroom: t.fromClassroom,
          toClassroom: t.toClassroom,
          requestId: String(t._id),
          reason: "ROOM_FULL",
        });
      }

      // notify lecturer/admin globally
      if (isLecturerLike) {
        alerts.push({
          type: "TRANSFER_ROOM_FULL",
          severity: "low",
          at,
          roomId: t.toClassroom,
          studentId: String(t.studentId),
          studentCode: t.studentCode || "",
          studentName: t.studentName || "",
          fromClassroom: t.fromClassroom,
          toClassroom: t.toClassroom,
          requestId: String(t._id),
          reason: "ROOM_FULL",
        });
      }
    }

    const pendingByStudent = new Set(
      pending
        .filter((t) => (isSupervisor ? normalizeRoomId(t.fromClassroom) === normalizeRoomId(myRoomId) : true))
        .map((t) => String(t.studentId))
    );

    const attendanceWithTransfers = visibleAttendance.map((a) => {
      const plain = typeof a?.toObject === "function" ? a.toObject() : { ...a };
      if (pendingByStudent.has(String(plain.studentId))) return { ...plain, status: "moving" };
      return plain;
    });

    // ---------------- Events visibility ----------------
    const rawEvents = (exam.events || []).slice(-30).reverse();

    const visibleEvents =
      isSupervisor && myRoomId
        ? rawEvents.filter((e) => !e.classroom || normalizeRoomId(e.classroom) === normalizeRoomId(myRoomId))
        : rawEvents;

    const examPayload = {
      id: String(exam._id),
      courseName: exam.courseName,
      examMode: exam.examMode,
      examDate: exam.examDate,
      startAt: exam.startAt,
      endAt: exam.endAt,
      status: exam.status,
      lecturer: exam.lecturer,
      coLecturers: exam.coLecturers || [],
      supervisors: exam.supervisors || [],
      classrooms: exam.classrooms || [],
      reportSummary: exam.report?.summary || {},
    };

    return res.json({
      me: {
        id: String(user._id),
        role: user.role,
        username: user.username,
        fullName: user.fullName,
        assignedRoomId: isSupervisor ? myRoomId || null : user.assignedRoomId || null,
      },
      exam: {
        ...examPayload,
        attendance: attendanceWithTransfers,
        reportStudentStats: studentStats,
        reportStudentFiles: studentFiles,
      },
      attendance: attendanceWithTransfers,
      transfers,
      stats,
      alerts,
      inbox: { unread, recent: recentMessages },
      events: visibleEvents,
      reportStudentStats: studentStats,
      reportStudentFiles: studentFiles,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Dashboard error" });
  }
}
