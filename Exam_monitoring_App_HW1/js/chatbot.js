// chatbot.js
// Exam Assistant Bot – bubble + panel, pinned to the appShell bottom-right corner

// ---------- Small helpers ----------
function cb_el(tag, classNames = "", attrs = {}) {
  const el = document.createElement(tag);
  if (classNames) el.className = classNames;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function cb_addMessage(box, text, sender = "bot") {
  const align = sender === "bot" ? "items-start" : "items-end";
  const base =
    "max-w-[90%] text-xs px-3 py-2 rounded-2xl shadow-sm border leading-snug";
  const colors =
    sender === "bot"
      ? "bg-slate-50 border-slate-200 text-slate-800"
      : "bg-indigo-600 border-indigo-600 text-white";

  const wrap = cb_el("div", `w-full flex ${align} mb-1.5`);
  const bubble = cb_el("div", `${base} ${colors}`);
  bubble.textContent = text;
  wrap.appendChild(bubble);
  box.appendChild(wrap);

  box.scrollTop = box.scrollHeight;
}

// ---------- Context (role + screen + stats simulation) ----------
function cb_getContext() {
  const ctx = window.EXAM_APP_CONTEXT || {};
  return {
    role: ctx.role || "supervisor", // supervisor | lecturer | admin
    screen: ctx.screen || "dashboard", // home | dashboard | attendance | exams | reports
    examName: ctx.examName || "Exam",
    room: ctx.room || "Room A",
    startTime: ctx.startTime || "09:00",
    endTime: ctx.endTime || "12:00",
    remainingMinutes: ctx.remainingMinutes ?? null,
    stats: {
      present: ctx.stats?.present ?? 30,
      out: ctx.stats?.out ?? 1,
      absent: ctx.stats?.absent ?? 2,
      late: ctx.stats?.late ?? 1,
      exceptions: ctx.stats?.exceptions ?? 1
    },
    exits: ctx.exits || []
  };
}

// ---------- Content per screen ----------
function cb_renderGuide(box, ctx) {
  const { screen, role, examName, room, startTime, endTime, stats } = ctx;
  box.innerHTML = "";

  if (screen === "home") {
    cb_addMessage(box, "You are on the main panel.");
    cb_addMessage(box, "1️⃣ Choose an active exam and room.");
    cb_addMessage(box, "2️⃣ Then go to Dashboard or Attendance to start monitoring.");
    return;
  }

  if (screen === "dashboard") {
    cb_addMessage(box, `Dashboard for "${examName}".`);
    cb_addMessage(box, `• Before ${startTime}: check rooms, supervisors and start time.`);
    cb_addMessage(box, "• During exam: watch present/absent and any red alerts.");
    cb_addMessage(box, `• At ${endTime}: make sure all exams are collected.`);
    return;
  }

  if (screen === "attendance") {
    cb_addMessage(box, `Attendance in ${room}.`);
    cb_addMessage(box, "• Mark each student Present when they enter.");
    cb_addMessage(box, "• For late students: mark Late and note the time.");
    cb_addMessage(box, "• For bathroom exits: mark Exit and then Back when they return.");
    if (stats.out > 0) {
      cb_addMessage(
        box,
        `• There is ${stats.out} student out of the room – follow their return time.`
      );
    }
    return;
  }

  if (screen === "exams") {
    cb_addMessage(box, "Exam management.");
    cb_addMessage(box, "• Set date, start time and duration.");
    cb_addMessage(box, "• Assign rooms and supervisors.");
    cb_addMessage(box, "• Avoid overlaps for the same group.");
    if (role === "lecturer") {
      cb_addMessage(box, "• Check the exam fits the course rules.");
    }
    return;
  }

  if (screen === "reports") {
    cb_addMessage(box, "Reports & history.");
    cb_addMessage(box, "• Choose course and date range.");
    cb_addMessage(box, "• Review attendance, late students and exceptions.");
    cb_addMessage(box, "• Export a report if needed.");
    return;
  }

  cb_addMessage(box, "I can guide you based on the screen and role.");
}

function cb_renderAlerts(box, ctx) {
  const { screen, stats, remainingMinutes, exits } = ctx;
  box.innerHTML = "";

  if (screen === "attendance") {
    cb_addMessage(box, "Simulation – alerts for this room:");

    if (exits && exits.length > 0) {
      exits.forEach((ex) => {
        const text = `• Student ${ex.studentId} is out for ${ex.minutesOut} minutes.`;
        cb_addMessage(box, text);
        if (ex.minutesOut >= 20) {
          cb_addMessage(
            box,
            "  ↳ This exit is long (≥ 20 minutes) – treat as a possible exception and document it.",
            "bot"
          );
        }
      });
    }

    if (stats.late > 0) {
      cb_addMessage(
        box,
        `• ${stats.late} late student(s) – check that you wrote their entry time.`
      );
    }

    if (stats.exceptions > 0) {
      cb_addMessage(
        box,
        `• ${stats.exceptions} exception case(s) – make sure each has a short description in the report.`
      );
    }

    if (remainingMinutes !== null && remainingMinutes <= 30) {
      cb_addMessage(
        box,
        `• Only ${remainingMinutes} minutes left in this exam – start watching the room more closely.`
      );
    }

    if (
      !exits.length &&
      !stats.late &&
      !stats.exceptions &&
      !(remainingMinutes !== null && remainingMinutes <= 30)
    ) {
      cb_addMessage(
        box,
        "• No active alerts in this simulation – keep monitoring calmly."
      );
    }
    return;
  }

  if (screen === "dashboard") {
    cb_addMessage(box, "Simulation – overall risks:");

    if (stats.absent >= 5) {
      cb_addMessage(
        box,
        `• High number of absences: ${stats.absent} students did not arrive.`
      );
    }

    if (stats.exceptions >= 2) {
      cb_addMessage(
        box,
        `• Several exception cases: ${stats.exceptions} – check which rooms are involved.`
      );
    }

    if (stats.late >= 3) {
      cb_addMessage(
        box,
        `• Many late students: ${stats.late} – this may show a problem with instructions or room changes.`
      );
    }

    if (remainingMinutes !== null && remainingMinutes <= 30) {
      cb_addMessage(
        box,
        `• Exams are in the last ${remainingMinutes} minutes – supervisors should prepare to collect exams on time.`
      );
    }

    if (
      stats.absent < 5 &&
      stats.exceptions < 2 &&
      stats.late < 3 &&
      !(remainingMinutes !== null && remainingMinutes <= 30)
    ) {
      cb_addMessage(box, "• No major risks in this simulation.");
    }

    cb_addMessage(
      box,
      "If two or more risks are high together – inform the course coordinator."
    );
    return;
  }

  if (screen === "exams") {
    cb_addMessage(box, "Before the exam day, check:", "bot");
    cb_addMessage(box, "• No time overlap for the same group.");
    cb_addMessage(box, "• Room capacity is not exceeded.");
    cb_addMessage(box, "• Every room has an assigned supervisor.");
    return;
  }

  if (screen === "reports") {
    cb_addMessage(box, "Use reports to find risky exams:", "bot");
    cb_addMessage(box, "• Many absences in the same course.");
    cb_addMessage(box, "• Repeated long exits in the same room.");
    cb_addMessage(box, "• Exams with many late students.");
    return;
  }

  cb_addMessage(
    box,
    "I will highlight late students, long exits and missing exams here."
  );
}

function cb_renderSummary(box, ctx) {
  const { role, stats } = ctx;
  box.innerHTML = "";

  if (role === "lecturer") {
    cb_addMessage(box, "Summary – last 10 exams (simulation):");
    cb_addMessage(box, "• Average attendance: about 93%.");
    cb_addMessage(
      box,
      `• Late students: around ${Math.max(stats.late, 3)} per exam.`
    );
    cb_addMessage(box, "• Exceptions: 1–2 per exam.");
    cb_addMessage(
      box,
      "Most issues appear in the first 30 minutes and last 15 minutes."
    );
    return;
  }

  cb_addMessage(box, "Summary – your supervision (simulation):");
  cb_addMessage(box, "• You supervised a few exams this month.");
  cb_addMessage(
    box,
    "• Most exams had normal behavior and on-time returns from exits."
  );
  cb_addMessage(
    box,
    "• Only 1–2 exams required a serious exception report."
  );
  cb_addMessage(
    box,
    "Accurate documentation protects both you and the students."
  );
}

// ---------- Handle text questions ----------
function cb_handleQuestion(box, text) {
  const t = text.toLowerCase().trim();
  if (!t) return;

  cb_addMessage(box, text, "user");

  if (t.includes("late") || t.includes("איחור")) {
    cb_addMessage(
      box,
      "For a late student: allow them in if rules permit, mark Late and write the time in the report."
    );
    return;
  }
  if (t.includes("exit") || t.includes("יציאה") || t.includes("bathroom")) {
    cb_addMessage(
      box,
      "For bathroom exits: mark Exit and Back with times. If the time is long (e.g. >20 minutes), treat as exception."
    );
    return;
  }
  if (t.includes("exception") || t.includes("חריג")) {
    cb_addMessage(
      box,
      "Exception: write a short, clear description (who, when, what happened). This helps the lecturer later."
    );
    return;
  }
  if (t.includes("report") || t.includes("דו")) {
    cb_addMessage(
      box,
      "Use the Reports screen to export a summary with attendance and exceptions for this exam."
    );
    return;
  }

  cb_addMessage(
    box,
    "Try to ask a short question, for example: 'late student', 'long exit', 'exception', 'report'."
  );
}

// ---------- Build UI (bubble + panel) ----------
document.addEventListener("DOMContentLoaded", () => {
  const ctx = cb_getContext();

  // נצמיד את הצ'אט ל־appShell אם קיים, אחרת לגוף הדף
  const container = document.getElementById("appShell") || document.body;
  // חשוב שהקונטיינר יהיה position: relative ב־HTML שלך

  // 🔴 Badge: כמה התראות + אזהרה אם נשארו ≤ 30 דקות
  let alertCount = 0;
  if (ctx.stats.exceptions) alertCount += ctx.stats.exceptions;
  if (ctx.stats.late) alertCount += ctx.stats.late;
  if (ctx.remainingMinutes !== null && ctx.remainingMinutes <= 30) alertCount += 1;

  // בועה בפינה הימנית־תחתונה
  const bubbleBtn = cb_el(
    "button",
    "absolute bottom-2 right-2 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center text-3xl hover:bg-indigo-700 transition-all z-50",
    { type: "button", "aria-label": "Open chatbot" }
  );
  bubbleBtn.textContent = "🤖";

  // Badge קטן מעל הבועה
  if (alertCount > 0) {
    const badge = cb_el(
      "span",
      "absolute -top-1 -right-1 min-w-[22px] h-5 px-1 rounded-full bg-red-600 text-[10px] text-white flex items-center justify-center font-bold shadow-md"
    );
    badge.textContent = alertCount;
    bubbleBtn.appendChild(badge);
  }

  // חלון צ'אט
  const panel = cb_el(
    "div",
    "absolute bottom-20 right-2 w-96 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40 hidden"
  );

  // Header
  const header = cb_el(
    "div",
    "flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-2xl"
  );
  const hLeft = cb_el("div", "flex items-center gap-2");
  const dot = cb_el("span", "w-2 h-2 rounded-full bg-emerald-500");
  const hTextBox = cb_el("div");
  const hTitle = cb_el("p", "text-xs font-semibold text-slate-800");
  hTitle.textContent = "Exam Assistant Bot";
  const hSub = cb_el("p", "text-[10px] text-slate-500");
  hSub.textContent = `${ctx.role} · ${ctx.screen}`;
  hTextBox.appendChild(hTitle);
  hTextBox.appendChild(hSub);
  hLeft.appendChild(dot);
  hLeft.appendChild(hTextBox);

  const closeBtn = cb_el(
    "button",
    "text-slate-400 hover:text-slate-600 text-lg",
    { type: "button", "aria-label": "Close chatbot" }
  );
  closeBtn.textContent = "×";

  header.appendChild(hLeft);
  header.appendChild(closeBtn);

  // Messages
  const msgBox = cb_el(
    "div",
    "flex-1 overflow-y-auto px-3 py-2 bg-white max-h-64"
  );

  // כפתורי מצב
  const btnRow = cb_el(
    "div",
    "flex gap-1 px-3 py-2 border-t border-slate-100 bg-slate-50"
  );
  const btnGuide = cb_el(
    "button",
    "flex-1 text-[11px] px-2 py-1 rounded-full bg-indigo-600 text-white font-medium",
    { type: "button" }
  );
  btnGuide.textContent = "Guide";

  const btnAlerts = cb_el(
    "button",
    "flex-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700",
    { type: "button" }
  );
  btnAlerts.textContent = "Alerts";

  const btnSummary = cb_el(
    "button",
    "flex-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700",
    { type: "button" }
  );
  btnSummary.textContent = "Summary";

  btnRow.appendChild(btnGuide);
  btnRow.appendChild(btnAlerts);
  btnRow.appendChild(btnSummary);

  // שורת קלט
  const inputRow = cb_el(
    "div",
    "px-3 py-2 border-t border-slate-200 bg-white rounded-b-2xl flex items-center gap-2"
  );
  const input = cb_el(
    "input",
    "flex-1 text-xs px-2 py-1 rounded-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500",
    { type: "text", placeholder: "Ask about late, exit, report..." }
  );
  const sendBtn = cb_el(
    "button",
    "text-[11px] px-3 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700",
    { type: "button" }
  );
  sendBtn.textContent = "Send";

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  // בניית הפאנל
  panel.appendChild(header);
  panel.appendChild(msgBox);
  panel.appendChild(btnRow);
  panel.appendChild(inputRow);

  // להוסיף לדף (לא ל-body, אלא ל-appShell)
  container.appendChild(bubbleBtn);
  container.appendChild(panel);

  // הודעת פתיחה + אם נשארו ≤ 30 דקות
  cb_addMessage(
    msgBox,
    "Hi, I am your exam assistant. Use Guide, Alerts or Summary for this screen."
  );
  if (ctx.remainingMinutes !== null && ctx.remainingMinutes <= 30) {
    cb_addMessage(
      msgBox,
      `⚠ Only ${ctx.remainingMinutes} minutes left in this exam – prepare for collection.`,
      "bot"
    );
  }

  // מצב לחצנים
  function setMode(mode) {
    btnGuide.className =
      "flex-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700";
    btnAlerts.className =
      "flex-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700";
    btnSummary.className =
      "flex-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700";

    if (mode === "guide") {
      btnGuide.className =
        "flex-1 text-[11px] px-2 py-1 rounded-full bg-indigo-600 text-white font-medium";
      cb_renderGuide(msgBox, ctx);
    } else if (mode === "alerts") {
      btnAlerts.className =
        "flex-1 text-[11px] px-2 py-1 rounded-full bg-indigo-600 text-white font-medium";
      cb_renderAlerts(msgBox, ctx);
    } else {
      btnSummary.className =
        "flex-1 text-[11px] px-2 py-1 rounded-full bg-indigo-600 text-white font-medium";
      cb_renderSummary(msgBox, ctx);
    }
  }

  // אירועים
  bubbleBtn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  btnGuide.addEventListener("click", () => setMode("guide"));
  btnAlerts.addEventListener("click", () => setMode("alerts"));
  btnSummary.addEventListener("click", () => setMode("summary"));

  function sendInput() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    cb_handleQuestion(msgBox, text);
  }

  sendBtn.addEventListener("click", sendInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendInput();
    }
  });
});
