// server/src/controllers/reports.controller.js
import PDFDocument from "pdfkit";
import Exam from "../models/Exam.js";

function ensureLecturerOrAdmin(req, res) {
  const actor = req.user;
  if (!actor || !["admin", "lecturer"].includes(actor.role)) {
    res.status(403).json({ message: "Lecturer/Admin only" });
    return null;
  }
  return actor;
}

function fmtDate(d) {
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "-";
    return x.toISOString().slice(0, 10);
  } catch {
    return "-";
  }
}

function msToHM(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

const ATTENDED_STATUSES = new Set(["present", "finished", "temp_out", "moving"]);
function isAttendedStatus(s) {
  return ATTENDED_STATUSES.has(String(s || ""));
}

function isIncidentType(t) {
  return String(t || "").includes("incident");
}

function isCheatingIncidentType(t) {
  const x = String(t || "");
  // supports: incident.cheating / incident.copy / incident.phone / incident.suspicious ...
  if (!x.includes("incident")) return false;
  return (
    x.includes("cheating") ||
    x.includes("copy") ||
    x.includes("phone") ||
    x.includes("suspicious") ||
    x.includes("impersonation")
  );
}

function isToiletType(t) {
  const x = String(t || "");
  return x.includes("toilet") || x.includes("bathroom");
}

function isTeacherCallType(t) {
  const x = String(t || "");
  return x.includes("teacher_call") || x.includes("call_teacher") || x.includes("teacher.call");
}

/* =========================
   Per-room stats (for single report details)
========================= */
function computeRoomStats(exam) {
  const rooms = (exam?.classrooms || [])
    .map((r) => String(r?.id || r?.name || "").trim())
    .filter(Boolean);

  const map = new Map();
  for (const roomId of rooms) {
    map.set(roomId, {
      roomId,
      total: 0,
      present: 0,       // will be overridden as "calculated present"
      not_arrived: 0,
      absent: 0,
      temp_out: 0,
      moving: 0,
      finished: 0,
      violations: 0,
      attended: 0,      // keep for other analytics if needed
    });
  }

  for (const a of exam?.attendance || []) {
    const roomId = String(a?.roomId || a?.classroom || "").trim() || "UNKNOWN";
    if (!map.has(roomId)) {
      map.set(roomId, {
        roomId,
        total: 0,
        present: 0,
        not_arrived: 0,
        absent: 0,
        temp_out: 0,
        moving: 0,
        finished: 0,
        violations: 0,
        attended: 0,
      });
    }

    const row = map.get(roomId);
    row.total += 1;

    const st = String(a?.status || "not_arrived");
    if (st in row) row[st] += 1;

    // keep attended logic (useful for other charts),
    // but the table "present" will be calculated below
    if (isAttendedStatus(st)) row.attended += 1;

    row.violations += Number(a?.violations || 0);
  }

  // incidents by room from events
  const incidentsByRoom = new Map();
  for (const e of exam?.events || []) {
    if (!isIncidentType(e?.type)) continue;
    const roomId = String(e?.classroom || "").trim() || "UNKNOWN";
    incidentsByRoom.set(roomId, (incidentsByRoom.get(roomId) || 0) + 1);
  }

  const out = Array.from(map.values()).map((x) => {
    // ✅ YOUR RULE:
    // present = total - not_arrived
    const presentCalculated = Math.max(
      0,
      Number(x.total || 0) - Number(x.not_arrived || 0)
    );

    return {
      ...x,
      // override present in the response used by the table + CSV/PDF
      present: presentCalculated,

      incidents: incidentsByRoom.get(x.roomId) || 0,

      // ✅ make rate match the same logic (so it's consistent with your table)
      attendanceRate: x.total
        ? Math.round((presentCalculated / x.total) * 1000) / 10
        : 0,
    };
  });

  out.sort((a, b) => String(a.roomId).localeCompare(String(b.roomId)));
  return out;
}


function computeExamKPIs(exam) {
  const sum = exam?.report?.summary || {};
  const total = Number(sum.totalStudents || exam?.attendance?.length || 0);

  const events = exam?.events || [];
  const incidents = events.filter((e) => isIncidentType(e?.type)).length;
  const critical = events.filter((e) => String(e?.severity || "") === "critical").length;

  const startAt = exam?.startAt ? new Date(exam.startAt) : null;
  const endAt = exam?.endAt ? new Date(exam.endAt) : null;
  const durationMs = startAt && endAt ? endAt.getTime() - startAt.getTime() : 0;

  const present = Number(sum.present || 0);
  const finished = Number(sum.finished || 0);
  const temp_out = Number(sum.temp_out || 0);

  // ✅ Real attended count for ended exams:
  const attended = present + finished + temp_out; // (you can add moving too if you want)

  return {
    examId: String(exam._id),
    courseName: exam.courseName,
    examMode: exam.examMode,
    date: fmtDate(exam.examDate),
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    durationText: durationMs ? msToHM(durationMs) : "-",
    status: exam.status,

    lecturerName: exam?.lecturer?.name || "",
    lecturerId: exam?.lecturer?.id ? String(exam.lecturer.id) : "",

    rooms: (exam?.classrooms || []).map((r) => r?.id || r?.name).filter(Boolean),

    totalStudents: total,
    present,
    not_arrived: Number(sum.not_arrived || 0),
    absent: Number(sum.absent || 0),
    temp_out,
    finished,
    violations: Number(sum.violations || 0),

    incidents,
    critical,

    // ✅ IMPORTANT FIX
    attended,
    attendanceRate: total ? Math.round((attended / total) * 1000) / 10 : 0,
  };
}

/* =========================
   GET /api/reports
========================= */
export async function listReports(req, res) {
  const actor = ensureLecturerOrAdmin(req, res);
  if (!actor) return;

  const q = { status: "ended" };
  if (actor.role === "lecturer") q["lecturer.id"] = actor._id;

  const exams = await Exam.find(q).sort({ endAt: -1, examDate: -1 }).limit(200);
  const out = exams.map((e) => computeExamKPIs(e));
  res.json({ exams: out });
}

/* =========================
   ✅ NEW: GET /api/reports/analytics
   returns 4 charts data
========================= */
export async function getReportsAnalytics(req, res) {
  const actor = ensureLecturerOrAdmin(req, res);
  if (!actor) return;

  const q = { status: "ended" };
  if (actor.role === "lecturer") q["lecturer.id"] = actor._id;

  const exams = await Exam.find(q).sort({ endAt: 1, examDate: 1 }).limit(500);

  // 1) Attendance per exam
  const attendanceSeries = exams.map((e) => {
    const k = computeExamKPIs(e);
    return {
      examId: k.examId,
      label: `${k.courseName} • ${k.date}`,
      attended: k.attended,
      total: k.totalStudents,
      rate: k.attendanceRate,
    };
  });

  // 2) Cheating incidents per supervisor
  const cheatingBySupervisor = new Map(); // key: supervisorId, {name, count}
  for (const e of exams) {
    const supIdToName = new Map();
    for (const s of e?.supervisors || []) {
      if (!s?.id) continue;
      supIdToName.set(String(s.id), String(s?.name || "Supervisor"));
    }

    for (const ev of e?.events || []) {
      if (!isCheatingIncidentType(ev?.type)) continue;

      // try map room -> supervisor
      const roomId = String(ev?.classroom || "").trim();
      const sup = (e?.supervisors || []).find((x) => String(x?.roomId || "") === roomId);
      const supId = sup?.id ? String(sup.id) : "UNKNOWN";
      const supName = sup?.name || supIdToName.get(supId) || "Unknown";

      const cur = cheatingBySupervisor.get(supId) || { supervisorId: supId, name: supName, count: 0 };
      cur.count += 1;
      cur.name = supName;
      cheatingBySupervisor.set(supId, cur);
    }
  }
  const cheatingSeries = Array.from(cheatingBySupervisor.values()).sort((a, b) => b.count - a.count);

  // 3) Toilet exits per room
  const toiletByRoom = new Map();
  for (const e of exams) {
    for (const ev of e?.events || []) {
      if (!isToiletType(ev?.type)) continue;
      const roomId = String(ev?.classroom || "").trim() || "UNKNOWN";
      toiletByRoom.set(roomId, (toiletByRoom.get(roomId) || 0) + 1);
    }
  }
  const toiletSeries = Array.from(toiletByRoom.entries())
    .map(([roomId, count]) => ({ roomId, count }))
    .sort((a, b) => String(a.roomId).localeCompare(String(b.roomId)));

  // 4) Teacher calls per room
  const teacherByRoom = new Map();
  for (const e of exams) {
    for (const ev of e?.events || []) {
      if (!isTeacherCallType(ev?.type)) continue;
      const roomId = String(ev?.classroom || "").trim() || "UNKNOWN";
      teacherByRoom.set(roomId, (teacherByRoom.get(roomId) || 0) + 1);
    }
  }
  const teacherSeries = Array.from(teacherByRoom.entries())
    .map(([roomId, count]) => ({ roomId, count }))
    .sort((a, b) => String(a.roomId).localeCompare(String(b.roomId)));

  // some KPIs for top bar
  const avgAttendanceRate =
    attendanceSeries.length
      ? Math.round(
          (attendanceSeries.reduce((acc, x) => acc + Number(x.rate || 0), 0) / attendanceSeries.length) * 10
        ) / 10
      : 0;

  res.json({
    kpis: {
      endedExams: exams.length,
      avgAttendanceRate,
      totalCheatingIncidents: cheatingSeries.reduce((a, x) => a + x.count, 0),
      totalToiletExits: toiletSeries.reduce((a, x) => a + x.count, 0),
      totalTeacherCalls: teacherSeries.reduce((a, x) => a + x.count, 0),
    },
    charts: {
      attendanceSeries,
      cheatingSeries,
      toiletSeries,
      teacherSeries,
    },
  });
}

/* =========================
   GET /api/reports/:examId
========================= */
export async function getReportDetails(req, res) {
  const actor = ensureLecturerOrAdmin(req, res);
  if (!actor) return;

  const { examId } = req.params;

  const exam = await Exam.findById(examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  if (actor.role === "lecturer" && String(exam?.lecturer?.id || "") !== String(actor._id)) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const kpis = computeExamKPIs(exam);
  const roomStats = computeRoomStats(exam);

  const incidents = (exam?.events || [])
    .filter((e) => isIncidentType(e?.type))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(0, 40)
    .map((e) => ({
      at: e.timestamp,
      type: e.type,
      severity: e.severity,
      roomId: e.classroom,
      seat: e.seat,
      description: e.description,
    }));

  res.json({
    exam: kpis,
    roomStats,
    incidents,
    notes: exam?.report?.notes || exam?.note || "",
    generatedAt: exam?.report?.generatedAt || null,
  });
}

/* =========================
   GET /api/reports/:examId/csv
========================= */
export async function downloadReportCSV(req, res) {
  const actor = ensureLecturerOrAdmin(req, res);
  if (!actor) return;

  const { examId } = req.params;
  const exam = await Exam.findById(examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  if (actor.role === "lecturer" && String(exam?.lecturer?.id || "") !== String(actor._id)) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const roomStats = computeRoomStats(exam);
  const kpis = computeExamKPIs(exam);

  const lines = [];
  lines.push(
    ["Course", "Date", "Duration", "Room", "Total", "Present", "NotArrived", "Absent", "TempOut", "Finished", "Attended", "Incidents", "Violations", "AttendanceRate%"].join(
      ","
    )
  );

  for (const r of roomStats) {
    lines.push(
      [
        `"${kpis.courseName}"`,
        kpis.date,
        `"${kpis.durationText}"`,
        r.roomId,
        r.total,
        r.present,
        r.not_arrived,
        r.absent,
        r.temp_out,
        r.finished,
        r.attended,
        r.incidents,
        r.violations,
        r.attendanceRate,
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Report_${kpis.courseName.replace(/[^\w]+/g, "_")}_${kpis.date}.csv"`);
  res.send(csv);
}

/* =========================
   GET /api/reports/:examId/pdf
========================= */
export async function downloadReportPDF(req, res) {
  const actor = ensureLecturerOrAdmin(req, res);
  if (!actor) return;

  const { examId } = req.params;
  const exam = await Exam.findById(examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  if (actor.role === "lecturer" && String(exam?.lecturer?.id || "") !== String(actor._id)) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const kpis = computeExamKPIs(exam);
  const roomStats = computeRoomStats(exam);

  const incidents = (exam?.events || [])
    .filter((e) => isIncidentType(e?.type))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(0, 25);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Report_${kpis.courseName.replace(/[^\w]+/g, "_")}_${kpis.date}.pdf"`);

  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);

  doc.fontSize(18).text("Exam Monitoring Report", { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#555").text(`Generated: ${new Date().toISOString()}`);
  doc.fillColor("#000");
  doc.moveDown(1);

  doc.fontSize(13).text("Exam Summary");
  doc.moveDown(0.4);
  doc.fontSize(11);
  doc.text(`Course: ${kpis.courseName}`);
  doc.text(`Date: ${kpis.date}   Duration: ${kpis.durationText}   Mode: ${kpis.examMode}`);
  doc.text(`Lecturer: ${kpis.lecturerName}`);
  doc.text(`Rooms: ${(kpis.rooms || []).join(", ") || "-"}`);
  doc.moveDown(0.6);

  doc.fontSize(11).text(
    `Students: ${kpis.totalStudents} | Present: ${kpis.present} | Temp Out: ${kpis.temp_out} | Absent: ${kpis.absent} | Not Arrived: ${kpis.not_arrived} | Finished: ${kpis.finished} | Attended: ${kpis.attended}`
  );
  doc.text(`Attendance Rate: ${kpis.attendanceRate}% | Incidents: ${kpis.incidents} (critical: ${kpis.critical}) | Violations: ${kpis.violations}`);
  doc.moveDown(1);

  doc.fontSize(13).text("Room Breakdown");
  doc.moveDown(0.4);
  doc.fontSize(10);

  const headers = ["Room", "Total", "Present", "NotArr.", "TempOut", "Absent", "Finished", "Attended", "Incidents", "Viol."];
  doc.text(headers.join("   "));
  doc.moveDown(0.2);
  doc.text("-".repeat(100));
  doc.moveDown(0.3);

  for (const r of roomStats) {
    const row = [r.roomId, r.total, r.present, r.not_arrived, r.temp_out, r.absent, r.finished, r.attended, r.incidents, r.violations];
    doc.text(row.join("      "));
  }

  doc.moveDown(1);

  doc.fontSize(13).text("Incidents (Top)");
  doc.moveDown(0.4);
  doc.fontSize(10);

  if (!incidents.length) {
    doc.text("No incidents were logged for this exam.");
  } else {
    for (const e of incidents) {
      const at = fmtDate(e.timestamp) + " " + String(new Date(e.timestamp).toISOString().slice(11, 16));
      doc.text(`• [${e.severity}] ${at} | ${e.classroom || "-"} ${e.seat || ""} | ${e.type}`);
      doc.fillColor("#555").text(`  ${e.description || ""}`);
      doc.fillColor("#000");
      doc.moveDown(0.2);
    }
  }

  doc.end();
}
