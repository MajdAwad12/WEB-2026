import Exam from "../models/Exam.js";

function pushTimeline(exam, payload) {
  if (!exam.report) exam.report = {};
  if (!Array.isArray(exam.report.timeline)) exam.report.timeline = [];
  exam.report.timeline.push(payload);
}

function isRecipient(msg, user) {
  const uid = String(user._id);
  const toUserIds = (msg.toUserIds || []).map(String);
  const toRoles = msg.toRoles || [];
  if (toUserIds.includes(uid)) return true;
  if (toRoles.includes(user.role)) return true;
  return false;
}

export async function sendMessage(req, res) {
  try {
    const { examId } = req.params;
    const { text, toRoles = [], toUserIds = [], roomId = "" } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ message: "Message text is required" });

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const actor = req.user;

    const msg = {
      at: new Date(),
      from: { id: actor._id, name: actor.fullName, role: actor.role },
      toRoles: Array.isArray(toRoles) ? toRoles : [],
      toUserIds: Array.isArray(toUserIds) ? toUserIds : [],
      roomId: String(roomId || ""),
      text: String(text).trim(),
      readBy: [actor._id],
    };

    exam.messages = exam.messages || [];
    exam.messages.push(msg);

    pushTimeline(exam, {
      kind: "MESSAGE",
      at: msg.at,
      roomId: msg.roomId,
      actor: { id: actor._id, name: actor.fullName, role: actor.role },
      student: {},
      details: {
        text: msg.text,
        toRoles: msg.toRoles,
        toUserIds: msg.toUserIds,
      },
    });

    await exam.save();
    return res.json({ message: "Sent", item: msg });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function listMessages(req, res) {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const user = req.user;
    const items = (exam.messages || [])
      .filter((m) => isRecipient(m, user) || String(m.from?.id) === String(user._id))
      .slice(-50)
      .reverse();

    const unread = items.filter((m) => !(m.readBy || []).map(String).includes(String(user._id))).length;

    return res.json({ items, unread });
  } catch (err) {
    console.error("listMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function markAllRead(req, res) {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const user = req.user;
    const uid = String(user._id);

    for (const m of exam.messages || []) {
      if (!m.readBy) m.readBy = [];
      const rb = m.readBy.map(String);
      if (!rb.includes(uid)) m.readBy.push(user._id);
    }

    await exam.save();
    return res.json({ message: "OK" });
  } catch (err) {
    console.error("markAllRead error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
