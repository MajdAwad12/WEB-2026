// server/src/controllers/student.controller.js
import mongoose from "mongoose";
import Exam from "../models/Exam.js";

function ensureStudent(req, res) {
  const actor = req.user;
  if (!actor || actor.role !== "student") {
    res.status(403).json({ message: "Student only" });
    return false;
  }
  return true;
}

function idStr(x) {
  try {
    return String(x || "").trim();
  } catch {
    return "";
  }
}

function mapGet(m, key) {
  if (!m) return null;
  if (typeof m.get === "function") return m.get(key) ?? null;
  return m[key] ?? null;
}

function safeDate(d) {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

function briefExamForStudent(exam, sidStr) {
  const a = (exam.attendance || []).find((x) => idStr(x.studentId) === sidStr);

  const roomId = a?.roomId || a?.classroom || "";
  const seat = a?.seat || "";

  return {
    id: exam._id.toString(),
    courseName: exam.courseName,
    examDate: safeDate(exam.examDate),
    startAt: safeDate(exam.startAt),
    endAt: safeDate(exam.endAt),
    status: exam.status,
    roomId,
    seat,
  };
}

// GET /api/student/exams
export async function listMyEndedExams(req, res) {
  try {
    if (!ensureStudent(req, res)) return;

    const sidStr = idStr(req.user._id);
    const sidObj = new mongoose.Types.ObjectId(sidStr); // ✅ IMPORTANT

    const exams = await Exam.find({
      status: "ended",
      "attendance.studentId": sidObj, // ✅ ObjectId query
    })
      .sort({ examDate: -1 })
      .select("courseName examDate startAt endAt status attendance");

    return res.json({
      exams: exams.map((e) => briefExamForStudent(e, sidStr)),
    });
  } catch (err) {
    console.error("listMyEndedExams ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/student/exams/:examId/me
export async function getMyExamReport(req, res) {
  try {
    if (!ensureStudent(req, res)) return;

    const sid = idStr(req.user._id);
    const examId = idStr(req.params.examId);

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    if (exam.status !== "ended") return res.status(400).json({ message: "Exam is not ended yet" });

    const attendance = (exam.attendance || []).find((x) => idStr(x.studentId) === sid);
    if (!attendance) return res.status(403).json({ message: "You are not part of this exam" });

    const studentFile = mapGet(exam.report?.studentFiles, sid) || {};
    const studentStat = mapGet(exam.report?.studentStats, sid) || {};

    const events = (exam.events || [])
      .filter((ev) => idStr(ev.studentId) === sid)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((ev) => ({
        type: ev.type,
        severity: ev.severity,
        at: safeDate(ev.timestamp),
        description: ev.description,
        classroom: ev.classroom || "",
        seat: ev.seat || "",
      }));

    const transfers = (exam.report?.timeline || [])
      .filter((t) => idStr(t?.student?.id) === sid && String(t?.kind || "").toLowerCase().includes("transfer"))
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .map((t) => ({
        at: safeDate(t.at),
        roomId: t.roomId || "",
        from: t.details?.fromRoomId || t.details?.from || "",
        to: t.details?.toRoomId || t.details?.to || "",
        reason: t.details?.reason || "",
        approvedBy: t.actor?.name || "",
      }));

    const messages = (exam.messages || [])
      .filter((m) => {
        const fromId = idStr(m?.from?.id);
        const toIds = (m?.toUserIds || []).map(idStr);
        return fromId === sid || toIds.includes(sid) || (m?.toRoles || []).includes("student");
      })
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .map((m) => ({
        at: safeDate(m.at),
        from: { name: m?.from?.name || "", role: m?.from?.role || "" },
        text: m?.text || "",
      }));

    return res.json({
      exam: {
        id: exam._id.toString(),
        courseName: exam.courseName,
        examDate: safeDate(exam.examDate),
        startAt: safeDate(exam.startAt),
        endAt: safeDate(exam.endAt),
        status: exam.status,
        lecturer: exam.lecturer ? { name: exam.lecturer.name || "" } : null,
      },
      me: {
        studentId: sid,
        name: attendance.name || req.user.fullName || "",
        studentNumber: attendance.studentNumber || "",
        roomId: attendance.roomId || attendance.classroom || "",
        seat: attendance.seat || "",
        status: attendance.status || "not_arrived",
        arrivedAt: safeDate(attendance.arrivedAt || studentFile.arrivedAt),
        finishedAt: safeDate(attendance.finishedAt || studentFile.finishedAt),
        violations: Number(attendance.violations || studentFile.violations || 0),
        incidentCount: Number(studentStat.incidentCount || studentFile.incidentCount || 0),
        toiletCount: Number(studentStat.toiletCount || studentFile.toiletCount || 0),
        totalToiletMs: Number(studentStat.totalToiletMs || studentFile.totalToiletMs || 0),
        score: typeof studentFile.score === "number" ? studentFile.score : null,
        notes: Array.isArray(studentFile.notes) ? studentFile.notes : [],
      },
      events,
      transfers,
      messages,
      timeline: (studentFile.timeline || []).map((x) => ({
        at: safeDate(x.at),
        kind: x.kind || "",
        note: x.note || "",
        severity: x.severity || "low",
        classroom: x.classroom || "",
        seat: x.seat || "",
      })),
    });
  } catch (err) {
    console.error("getMyExamReport ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
