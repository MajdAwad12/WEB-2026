// server/src/controllers/incidents.controller.js
import Exam from "../models/Exam.js";

function actorFromReq(req) {
  const u = req.user || req.session?.user || {};
  return {
    id: u.id || u._id,
    name: u.fullName || u.username || "",
    role: u.role || "",
  };
}

function ensureMaps(exam) {
  if (!exam.report) exam.report = {};
  if (!Array.isArray(exam.report.timeline)) exam.report.timeline = [];
  if (!exam.report.studentFiles) exam.report.studentFiles = new Map();
  if (!exam.report.studentStats) exam.report.studentStats = new Map();
  if (!exam.events) exam.events = [];
}

function ensureStudentFile(exam, studentId) {
  ensureMaps(exam);
  const key = String(studentId);
  const existing = exam.report.studentFiles.get(key);
  if (existing) return existing;

  const file = {
    arrivedAt: null,
    finishedAt: null,
    toiletCount: 0,
    totalToiletMs: 0,
    activeToilet: { leftAt: null, bySupervisorId: null },
    incidentCount: 0,
    violations: 0,
    notes: [],
    timeline: [],
  };

  exam.report.studentFiles.set(key, file);
  return file;
}

function ensureStudentStat(exam, studentId) {
  ensureMaps(exam);
  const key = String(studentId);
  const existing = exam.report.studentStats.get(key);
  if (existing) return existing;

  const stat = {
    toiletCount: 0,
    totalToiletMs: 0,
    activeToilet: { leftAt: null, bySupervisorId: null, reason: "toilet" },
    incidentCount: 0,
    lastIncidentAt: null,
  };

  exam.report.studentStats.set(key, stat);
  return stat;
}

function isGlobalKind(kind) {
  const k = String(kind || "").toUpperCase();
  return k === "CALL_LECTURER";
}

export async function logIncident(req, res) {
  const { examId } = req.params;
  const { studentId = null, kind, severity = "low", note = "", meta = {} } = req.body || {};

  if (!kind) {
    return res.status(400).json({ message: "kind is required" });
  }

  // ✅ for global events (CALL_LECTURER) studentId is optional
  if (!isGlobalKind(kind) && !studentId) {
    return res.status(400).json({ message: "studentId is required for this incident kind" });
  }

  const exam = await Exam.findById(examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  ensureMaps(exam);

  const actor = actorFromReq(req);

  // find attendance record if studentId exists
  const a =
    studentId != null
      ? (exam.attendance || []).find((x) => String(x.studentId) === String(studentId))
      : null;

  const classroom =
    meta.room || meta.classroom || a?.roomId || a?.classroom || "";
  const seat = meta.seat || a?.seat || "";

  // 1) Save to exam.events (for dashboard cards / feed)
  exam.events.push({
    type: String(kind),
    timestamp: new Date(),
    description: String(note || ""),
    severity,
    classroom,
    seat,
    studentId: studentId || null,
    actor,
  });

  // 2) Save to exam.report.timeline (global exam report)
  exam.report.timeline.push({
    kind: "INCIDENT",
    at: new Date(),
    roomId: classroom,
    actor,
    student: studentId
      ? {
          id: studentId,
          name: a?.name || "",
          code: a?.studentNumber || "",
          seat,
          classroom,
        }
      : null,
    details: { kind, severity, note, meta },
  });

  // 3) If this is student-related => save to student file/stats
  if (studentId) {
    const file = ensureStudentFile(exam, studentId);
    const stat = ensureStudentStat(exam, studentId);

    file.notes.push(`${kind}: ${note}`.trim());
    file.incidentCount = Number(file.incidentCount || 0) + 1;
    file.violations = Number(file.violations || 0) + 1;

    file.timeline.push({
      at: new Date(),
      kind: "INCIDENT",
      note: `${kind}: ${note}`.trim(),
      severity,
      classroom,
      seat,
      meta,
    });

    stat.incidentCount = Number(stat.incidentCount || 0) + 1;
    stat.lastIncidentAt = new Date();

    // bump attendance violations for quick UI
    if (a) a.violations = Number(a.violations || 0) + 1;

    if (!exam.report.summary) exam.report.summary = {};
    exam.report.summary.incidents = Number(exam.report.summary.incidents || 0) + 1;
    exam.report.summary.violations = Number(exam.report.summary.violations || 0) + 1;
  } else {
    // global incident summary
    if (!exam.report.summary) exam.report.summary = {};
    exam.report.summary.incidents = Number(exam.report.summary.incidents || 0) + 1;
  }

  await exam.save();
  const out = exam.toObject();
  return res.json({ ok: true, exam: { ...out, id: String(out._id) } });
}
