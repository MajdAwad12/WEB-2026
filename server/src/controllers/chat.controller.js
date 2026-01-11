// server/src/controllers/chat.controller.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import Exam from "../models/Exam.js";
import TransferRequest from "../models/TransferRequest.js";

/* =========================
   FAQ (common questions)
   (We NEVER tell user it's FAQ/local)
========================= */
const FAQ = [
  {
    match: (t) => t.includes("start") && t.includes("exam"),
    answer:
      "✅ **Start an exam**\n- Go to **Exam List**\n- Select the exam\n- Click **Start Exam** (or **Open Dashboard** if already running)\n- Pick a room tab to monitor seats and attendance.",
  },
  {
    match: (t) => t.includes("not arrived") || t.includes("gray") || t.includes("grey"),
    answer:
      "🟦 **Not arrived (gray)** means the student has not checked in yet.\n- Once you scan QR or mark Present, the student moves into the classroom map.",
  },
  {
    match: (t) => t.includes("toilet") || t.includes("bathroom") || t.includes("bath"),
    answer:
      "🚻 **Toilet tracking**\n- Click the student seat → Start Toilet\n- Timer runs live\n- On return → click Return\n- You will see count and total time.",
  },
  {
    match: (t) => t.includes("transfer") || t.includes("move room") || (t.includes("move") && t.includes("room")),
    answer:
      "🔁 **Transfer**\n- Click the student seat → Request Transfer\n- Choose target room\n- Student becomes purple while waiting\n- Target supervisor approves/rejects in Transfers Panel.",
  },
  {
    match: (t) => t.includes("purple"),
    answer: "🟪 **Purple** indicates a pending transfer request waiting for approval/rejection.",
  },
  {
    match: (t) =>
      t.includes("report") ||
      t.includes("history") ||
      t.includes("export") ||
      t.includes("csv") ||
      t.includes("pdf"),
    answer:
      "📄 **Reports & History (Lecturer)**\n- View statistics & incidents\n- Export CSV (Excel)\n- Print/export to PDF.",
  },
  {
    match: (t) => t === "help" || t.includes("what can you do") || t.includes("commands"),
    answer:
      "ℹ️ I can help with:\n- Live exam info (name, rooms, supervisors)\n- Live counts (present / not arrived / temp out / finished)\n- Time remaining\n- Transfers status\n- Events/messages overview\n- Procedures (start/attendance/toilet/transfers/reports)\n\nTip: ask 'room A101' or 'all rooms' to control the scope.",
  },
];

function faqAnswer(userText) {
  const t = String(userText || "").toLowerCase().trim();
  if (!t) return null;
  for (const f of FAQ) if (f.match(t)) return f.answer;
  return null;
}

/* =========================
   In-memory controls (safe + simple)
   NOTE: for production use Redis
========================= */
const mem = {
  dayKey: null,
  geminiUsed: 0,

  // key -> { text, expMs }
  cache: new Map(),

  // per-user anti-spam
  lastMsgAt: new Map(),

  // summarize cooldown per user
  lastSummAt: new Map(),
};

function nowMs() {
  return Date.now();
}
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function resetDailyIfNeeded() {
  const k = todayKey();
  if (mem.dayKey !== k) {
    mem.dayKey = k;
    mem.geminiUsed = 0;
    mem.cache = new Map();
  }
}
function cacheGet(key) {
  const item = mem.cache.get(key);
  if (!item) return null;
  if (item.expMs <= nowMs()) {
    mem.cache.delete(key);
    return null;
  }
  return item.text;
}
function cacheSet(key, text, ttlMs) {
  mem.cache.set(key, { text, expMs: nowMs() + ttlMs });
}

/* =========================
   Helpers
========================= */
function norm(s) {
  return String(s || "").toLowerCase().trim();
}
function msToHuman(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm} min`;
  return `${h}h ${mm}m`;
}
function formatDT(d) {
  if (!d) return "";
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    return x.toLocaleString();
  } catch {
    return "";
  }
}
function examTitle(exam) {
  return exam?.courseName || `Exam ${String(exam?._id || "").slice(-6)}`;
}
function pickTextFromGeminiResponse(data) {
  return (
    data?.response?.text?.() ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join("\n") ||
    ""
  );
}

/* =========================
   Room scope resolution
   - Supervisor default: assignedRoomId
   - Lecturer/Admin default: all rooms
   - User can override: "room A101", "in A101", "בכיתה A101", "all rooms"
========================= */
function extractExplicitRoomFromText(text) {
  const s = String(text || "");

  const m1 = s.match(/\b(room|class|classroom)\s*[:\-]?\s*([A-Z]\d{2,4})\b/i);
  if (m1?.[2]) return String(m1[2]).toUpperCase();

  const m2 = s.match(/\b(in|for)\s+([A-Z]\d{2,4})\b/i);
  if (m2?.[2]) return String(m2[2]).toUpperCase();

  const m3 = s.match(/(?:בכיתה|בחדר)\s*([A-Z]\d{2,4})/i);
  if (m3?.[1]) return String(m3[1]).toUpperCase();

  const m4 = s.match(/\b([A-Z]\d{2,4})\b/i);
  if (m4?.[1]) return String(m4[1]).toUpperCase();

  return null;
}

function wantsAllRooms(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("all rooms") ||
    t.includes("all classes") ||
    t.includes("all classrooms") ||
    t.includes("overall") ||
    t.includes("in total") ||
    t.includes("every room") ||
    t.includes("all of them") ||
    t.includes("כל הכיתות") ||
    t.includes("כל החדרים") ||
    t.includes("סה\"כ") ||
    t.includes("סה״כ")
  );
}

function resolveRoomScope(text, actor) {
  const explicit = extractExplicitRoomFromText(text);
  const all = wantsAllRooms(text);

  // Admin/Lecturer default = all rooms unless explicitly asked
  if (actor?.role === "admin" || actor?.role === "lecturer") {
    if (explicit) return { scope: "room", roomId: explicit, explicit: true };
    if (all) return { scope: "all", roomId: null, explicit: true };
    return { scope: "all", roomId: null, explicit: false };
  }

  // Supervisor default = assigned room unless asked otherwise
  if (actor?.role === "supervisor") {
    if (explicit) return { scope: "room", roomId: explicit, explicit: true };
    if (all) return { scope: "all", roomId: null, explicit: true };

    const assigned = actor?.assignedRoomId ? String(actor.assignedRoomId).toUpperCase() : null;
    return { scope: assigned ? "room" : "all", roomId: assigned, explicit: false };
  }

  // Student/other
  if (explicit) return { scope: "room", roomId: explicit, explicit: true };
  if (all) return { scope: "all", roomId: null, explicit: true };
  return { scope: "all", roomId: null, explicit: false };
}

/* =========================
   Find running exam with role scoping
========================= */
async function findRunningExamForActor(actor) {
  const baseOr = [
    { status: "running" },
    { isRunning: true },
    { $and: [{ startAt: { $ne: null } }, { endAt: null }, { status: { $ne: "ended" } }] },
  ];
  const sort = { startAt: -1, examDate: -1, createdAt: -1 };

  if (actor?.role === "admin") {
    return (await Exam.find({ $or: baseOr }).sort(sort).limit(1))[0] || null;
  }

  if (actor?.role === "lecturer") {
    return (
      (await Exam.find({
        $and: [
          { $or: baseOr },
          {
            $or: [{ "lecturer.id": actor._id }, { coLecturers: { $elemMatch: { id: actor._id } } }],
          },
        ],
      })
        .sort(sort)
        .limit(1))[0] || null
    );
  }

  if (actor?.role === "supervisor") {
    return (
      (await Exam.find({
        $and: [{ $or: baseOr }, { supervisors: { $elemMatch: { id: actor._id } } }],
      })
        .sort(sort)
        .limit(1))[0] || null
    );
  }

  if (actor?.role === "student") {
    return (
      (await Exam.find({
        $and: [{ $or: baseOr }, { attendance: { $elemMatch: { studentId: actor._id } } }],
      })
        .sort(sort)
        .limit(1))[0] || null
    );
  }

  return (await Exam.find({ $or: baseOr }).sort(sort).limit(1))[0] || null;
}

/* =========================
   MongoDB answers (facts)
========================= */
function countAttendance(exam, roomId = null) {
  const arr = Array.isArray(exam?.attendance) ? exam.attendance : [];
  const filtered = roomId ? arr.filter((a) => String(a?.roomId || "") === String(roomId)) : arr;

  const counts = {
    total: filtered.length,
    not_arrived: 0,
    present: 0,
    temp_out: 0,
    absent: 0,
    moving: 0,
    finished: 0,
  };

  for (const a of filtered) {
    const st = String(a?.status || "not_arrived");
    if (counts[st] !== undefined) counts[st] += 1;
    else counts.not_arrived += 1;
  }
  return counts;
}

async function getTransferStats(examId, roomId = null) {
  const base = { examId };
  const pending = await TransferRequest.countDocuments({ ...base, status: "pending" });
  const approved = await TransferRequest.countDocuments({ ...base, status: "approved" });
  const rejected = await TransferRequest.countDocuments({ ...base, status: "rejected" });
  const cancelled = await TransferRequest.countDocuments({ ...base, status: "cancelled" });

  let roomPending = null;
  if (roomId) {
    roomPending = await TransferRequest.countDocuments({
      ...base,
      status: "pending",
      $or: [{ fromClassroom: roomId }, { toClassroom: roomId }],
    });
  }

  return { pending, approved, rejected, cancelled, roomPending };
}

function isDataQuestion(t) {
  return (
    t.includes("how many") ||
    t.includes("count") ||
    t.includes("number") ||
    t.includes("time remaining") ||
    (t.includes("time") && (t.includes("remaining") || t.includes("left"))) ||
    t.includes("exam name") ||
    (t.includes("what") && t.includes("exam") && (t.includes("running") || t.includes("now") || t.includes("current"))) ||
    t.includes("rooms") ||
    t.includes("classrooms") ||
    t.includes("supervisors") ||
    t.includes("lecturer") ||
    t.includes("co-lecturer") ||
    t.includes("events") ||
    t.includes("incidents") ||
    t.includes("messages") ||
    t.includes("transfer") ||
    t.includes("summary") ||
    t.includes("stats")
  );
}

async function dbAnswer(userText, actor) {
  const t = norm(userText);
  if (!t) return null;
  if (!isDataQuestion(t)) return null;

  const exam = await findRunningExamForActor(actor);
  if (!exam) return "I couldn’t find a **running exam** right now for your account.";

  const title = examTitle(exam);

  const scope = resolveRoomScope(userText, actor);
  const roomId = scope.scope === "room" ? scope.roomId : null;

  // Exam name/status
  if (
    t.includes("exam name") ||
    (t.includes("what") && t.includes("exam") && (t.includes("running") || t.includes("now") || t.includes("current")))
  ) {
    return `🟢 **Running exam:** ${title}\n- Date: ${formatDT(exam.examDate)}\n- Status: ${exam.status}`;
  }

  // Time remaining
  if (
    (t.includes("time") && (t.includes("remaining") || t.includes("left"))) ||
    t.includes("time remaining") ||
    t.includes("how much time left") ||
    (t.includes("when") && t.includes("end"))
  ) {
    const end = exam?.endAt ? new Date(exam.endAt) : null;
    if (!end || Number.isNaN(end.getTime())) {
      return `⏳ I can’t calculate time remaining because **endAt** is missing.\n(Exam: ${title})`;
    }
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return `⛔ **Exam time window ended.**\n(Exam: ${title})`;
    return `⏳ **Time remaining:** ${msToHuman(diff)}\n(Exam: ${title})`;
  }

  // Rooms list
  if (t.includes("rooms") || t.includes("classrooms") || (t.includes("which") && (t.includes("room") || t.includes("classroom")))) {
    const rooms = (exam.classrooms || []).map((r) => r?.name || r?.id).filter(Boolean);
    if (!rooms.length) return `Rooms are not set for this exam.\n(Exam: ${title})`;
    return `🏫 **Exam rooms:**\n- ${rooms.join("\n- ")}\n(Exam: ${title})`;
  }

  // Supervisors list
  if (t.includes("supervisors") || (t.includes("who") && t.includes("supervisor"))) {
    const sup = Array.isArray(exam.supervisors) ? exam.supervisors : [];
    if (!sup.length) return `No supervisors assigned.\n(Exam: ${title})`;
    const lines = sup.map((s) => `- ${s?.name || "Supervisor"} (room: ${s?.roomId || "--"})`);
    return `👮 **Supervisors:**\n${lines.join("\n")}\n(Exam: ${title})`;
  }

  // Lecturers list
  if (t.includes("lecturer")) {
    const main = exam.lecturer
      ? `- Main lecturer: ${exam.lecturer.name} (rooms: ${exam.lecturer.roomIds?.join(", ") || "--"})`
      : null;

    const co = (exam.coLecturers || []).map(
      (l) => `- Co-lecturer: ${l?.name || "Lecturer"} (rooms: ${l?.roomIds?.join(", ") || "--"})`
    );

    const lines = [main, ...co].filter(Boolean);
    if (!lines.length) return `No lecturer assignment found.\n(Exam: ${title})`;
    return `🎓 **Lecturers:**\n${lines.join("\n")}\n(Exam: ${title})`;
  }

  // Attendance counts (scoped)
  if (t.includes("how many") || t.includes("count") || t.includes("number") || t.includes("summary") || t.includes("stats")) {
    const cAll = countAttendance(exam, null);
    const cScoped = roomId ? countAttendance(exam, roomId) : cAll;

    const wants = {
      present: t.includes("present"),
      not_arrived: t.includes("not arrived") || (t.includes("not") && t.includes("arrived")),
      absent: t.includes("absent"),
      temp_out: t.includes("temp_out") || (t.includes("temp") && t.includes("out")) || (t.includes("out") && t.includes("student")),
      moving: t.includes("moving"),
      finished: t.includes("finished"),
      full: t.includes("summary") || t.includes("stats"),
    };

    function pickOne(counts) {
      if (wants.present) return { label: "Present", val: counts.present };
      if (wants.not_arrived) return { label: "Not arrived", val: counts.not_arrived };
      if (wants.absent) return { label: "Absent", val: counts.absent };
      if (wants.temp_out) return { label: "Temp out", val: counts.temp_out };
      if (wants.moving) return { label: "Moving", val: counts.moving };
      if (wants.finished) return { label: "Finished", val: counts.finished };
      return { label: "Total students", val: counts.total };
    }

    const pick = pickOne(cScoped);

    if (wants.full) {
      const header = roomId ? `📊 **Attendance summary (Room ${roomId})**` : `📊 **Attendance summary (All rooms)**`;
      const body =
        `- Total: ${cScoped.total}\n` +
        `- Present: ${cScoped.present}\n` +
        `- Not arrived: ${cScoped.not_arrived}\n` +
        `- Temp out: ${cScoped.temp_out}\n` +
        `- Absent: ${cScoped.absent}\n` +
        `- Moving: ${cScoped.moving}\n` +
        `- Finished: ${cScoped.finished}\n`;

      const tip = roomId ? `\nTip: ask "all rooms summary" for overall totals.` : `\nTip: ask "room A101" for a specific room.`;
      return `${header}\n${body}${tip}\n(Exam: ${title})`;
    }

    const where = roomId ? `Room ${roomId}` : `All rooms`;
    const tip = roomId ? `Tip: ask "all rooms" for overall totals.` : `Tip: ask "in A101" to focus on one room.`;
    return `📌 **${pick.label} (${where}):** ${pick.val} / ${cScoped.total}\n${tip}\n(Exam: ${title})`;
  }

  // Transfers stats
  if (t.includes("transfer")) {
    const stats = await getTransferStats(exam._id, roomId);
    const lines = [
      `🔁 **Transfers (All rooms)**`,
      `- Pending: ${stats.pending}`,
      `- Approved: ${stats.approved}`,
      `- Rejected: ${stats.rejected}`,
      `- Cancelled: ${stats.cancelled}`,
    ];
    if (roomId && stats.roomPending !== null) lines.push(`\n🏫 **Room ${roomId} pending related:** ${stats.roomPending}`);
    lines.push(`\n(Exam: ${title})`);
    return lines.join("\n");
  }

  // Events overview
  if (t.includes("events") || t.includes("incidents")) {
    const events = Array.isArray(exam.events) ? exam.events : [];
    const incidentsCount = events.filter((e) => norm(e?.type).includes("incident")).length;

    if (t.includes("how many") || t.includes("count") || t.includes("number")) {
      if (t.includes("incident")) return `🚨 **Incidents:** ${incidentsCount}\n(Exam: ${title})`;
      return `🧾 **Events:** ${events.length}\n(Exam: ${title})`;
    }

    const last = events
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map((e) => {
        const ts = formatDT(e.timestamp) || "";
        const where = e.classroom ? ` (${e.classroom}${e.seat ? ` / ${e.seat}` : ""})` : "";
        return `- [${e.severity || "low"}] ${ts}: ${e.description || e.type || "event"}${where}`;
      });

    if (!last.length) return `No events recorded yet.\n(Exam: ${title})`;
    return `🧾 **Last events:**\n${last.join("\n")}\n(Exam: ${title})`;
  }

  // Messages overview
  if (t.includes("messages") || (t.includes("chat") && t.includes("exam"))) {
    const msgs = Array.isArray(exam.messages) ? exam.messages : [];
    if (t.includes("how many") || t.includes("count") || t.includes("number")) {
      return `💬 **Messages saved in this exam:** ${msgs.length}\n(Exam: ${title})`;
    }
    const last = msgs
      .slice()
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5)
      .map((m) => {
        const ts = formatDT(m.at) || "";
        const from = m?.from?.name ? `${m.from.name} (${m.from.role || ""})` : "User";
        const room = m.roomId ? ` [${m.roomId}]` : "";
        return `- ${ts}${room} ${from}: ${m.text || ""}`;
      });

    if (!last.length) return `No messages recorded yet.\n(Exam: ${title})`;
    return `💬 **Last messages:**\n${last.join("\n")}\n(Exam: ${title})`;
  }

  return null;
}

/* =========================
   Gemini: only for summarize/nice writing
   or when DB+FAQ didn't answer
========================= */
function isSummarizeIntent(t) {
  return (
    t.includes("summarize") ||
    t.includes("summary") ||
    (t.includes("make") && t.includes("report")) ||
    (t.includes("generate") && t.includes("report")) ||
    (t.includes("exam") && t.includes("summary"))
  );
}

async function buildSafeContext(actor) {
  const exam = await findRunningExamForActor(actor);
  if (!exam) return "";

  const title = examTitle(exam);

  // For context: show both all + supervisor room (if supervisor has one)
  const assigned = actor?.assignedRoomId ? String(actor.assignedRoomId).toUpperCase() : null;

  const cAll = countAttendance(exam, null);
  const cRoom = assigned ? countAttendance(exam, assigned) : null;

  const end = exam?.endAt ? new Date(exam.endAt) : null;
  const remaining = end && !Number.isNaN(end.getTime()) ? Math.max(0, end.getTime() - Date.now()) : null;

  const rooms = (exam.classrooms || []).map((r) => r?.name || r?.id).filter(Boolean);

  let text =
    `Exam: ${title}\n` +
    `Status: ${exam.status}\n` +
    `Date: ${formatDT(exam.examDate)}\n` +
    `StartAt: ${formatDT(exam.startAt)}\n` +
    `EndAt: ${formatDT(exam.endAt)}\n` +
    (remaining !== null ? `TimeRemainingMs: ${remaining}\n` : "") +
    `Rooms: ${rooms.join(", ") || "(none)"}\n` +
    `Attendance(All): total=${cAll.total}, present=${cAll.present}, not_arrived=${cAll.not_arrived}, temp_out=${cAll.temp_out}, absent=${cAll.absent}, moving=${cAll.moving}, finished=${cAll.finished}\n`;

  if (cRoom) {
    text += `Attendance(Room ${assigned}): total=${cRoom.total}, present=${cRoom.present}, not_arrived=${cRoom.not_arrived}, temp_out=${cRoom.temp_out}, absent=${cRoom.absent}, moving=${cRoom.moving}, finished=${cRoom.finished}\n`;
  }

  try {
    const ts = await getTransferStats(exam._id, assigned);
    text += `Transfers(All): pending=${ts.pending}, approved=${ts.approved}, rejected=${ts.rejected}, cancelled=${ts.cancelled}\n`;
    if (assigned && ts.roomPending !== null) text += `Transfers(Room ${assigned}): pending_related=${ts.roomPending}\n`;
  } catch {
    // ignore
  }

  return text;
}

async function geminiAnswer({ actor, message, contextText }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: "AI is not configured on the server." };

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const role = actor?.role || "user";
  const name = actor?.fullName || actor?.username || "User";

  const prompt = `
You are an Exam Monitoring Assistant for Braude College.

User: ${name} (role: ${role})
Question: "${message}"

System context (facts from database):
${contextText || "(none)"}

Rules:
- Use the system context for any numbers/facts. Do NOT invent numbers.
- Be concise and practical.
- Use bullets when helpful.
- If user asks for a summary/report: produce a clean structured summary.
- If user asks "in room X" then focus on that room.
`;

  const result = await model.generateContent(prompt);
  const text = pickTextFromGeminiResponse(result) || "";
  return { text: text.trim() || "I couldn't generate an answer. Try again." };
}

/* =========================
   Controller (Policy Router)
   1) MongoDB facts
   2) FAQ
   3) Gemini if needed / summarize
========================= */
export async function chatWithAI(req, res) {
  try {
    const actor = req.user;
    const message = String(req.body?.message || "").trim();

    if (!message) {
      res.status(400).json({ message: "message is required" });
      return;
    }

    // Anti-spam (per user)
    const uid = String(actor?._id || "anon");
    const last = mem.lastMsgAt.get(uid) || 0;
    const gapMs = nowMs() - last;
    const minGapMs = Number(process.env.CHAT_MIN_GAP_MS || 800); // default 0.8s

    if (gapMs < minGapMs) {
      res.json({ text: "Please wait a moment, then send your message again." });
      return;
    }
    mem.lastMsgAt.set(uid, nowMs());

    resetDailyIfNeeded();

    const t = norm(message);
    const wantSumm = isSummarizeIntent(t);

    // Summarize cooldown (per user)
    const summCooldownMs = Number(process.env.CHAT_SUMMARIZE_COOLDOWN_MS || 5 * 60 * 1000); // 5 min
    if (wantSumm) {
      const lastSumm = mem.lastSummAt.get(uid) || 0;
      if (nowMs() - lastSumm < summCooldownMs) {
        const snap = await dbAnswer("attendance summary", actor);
        res.json({
          text:
            (snap || "Summary is available shortly. Please try again in a few minutes.") +
            "\n\nTip: You can ask: 'time remaining' or 'transfers stats'.",
        });
        return;
      }
      mem.lastSummAt.set(uid, nowMs());

      const cacheKey = `SUMM:${uid}:${todayKey()}`;
      const cached = cacheGet(cacheKey);
      if (cached) {
        res.json({ text: cached });
        return;
      }

      const maxPerDay = Number(process.env.GEMINI_MAX_PER_DAY || 20);
      if (mem.geminiUsed >= maxPerDay) {
        const snap = await dbAnswer("attendance summary", actor);
        res.json({
          text:
            (snap || "I can help with live exam info from the dashboard.") +
            "\n\nTip: Ask: 'time remaining', 'how many present', 'rooms list', 'transfers pending'.",
        });
        return;
      }

      const ctx = await buildSafeContext(actor);
      mem.geminiUsed += 1;

      const out = await geminiAnswer({ actor, message, contextText: ctx });

      cacheSet(cacheKey, out.text, Number(process.env.CHAT_SUMMARIZE_CACHE_TTL_MS || 2 * 60 * 1000));
      res.json({ text: out.text });
      return;
    }

    // 1) MongoDB first (facts)
    const db = await dbAnswer(message, actor);
    if (db) {
      res.json({ text: db });
      return;
    }

    // 2) FAQ next
    const faq = faqAnswer(message);
    if (faq) {
      res.json({ text: faq });
      return;
    }

    // 3) Gemini last
    const cacheKey = `Q:${todayKey()}:${t}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.json({ text: cached });
      return;
    }

    const maxPerDay = Number(process.env.GEMINI_MAX_PER_DAY || 20);
    if (mem.geminiUsed >= maxPerDay) {
      res.json({
        text:
          "I can help with live exam info and procedures.\nTry asking:\n- 'How many present?'\n- 'Time remaining?'\n- 'Attendance summary'\n- 'Transfers pending'\n- 'Rooms list'\nOr type 'help'.",
      });
      return;
    }

    const ctx = await buildSafeContext(actor);
    mem.geminiUsed += 1;

    const out = await geminiAnswer({ actor, message, contextText: ctx });

    cacheSet(cacheKey, out.text, Number(process.env.CHAT_GEMINI_CACHE_TTL_MS || 24 * 60 * 60 * 1000));
    res.json({ text: out.text });
  } catch (err) {
    console.error("chatWithAI error:", err);
    res.status(500).json({ message: "Chat failed" });
  }
}
