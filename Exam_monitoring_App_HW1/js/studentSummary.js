// studentSummary.js
// Read-only view for the student: exam summary, times and incidents

document.addEventListener("DOMContentLoaded", () => {
  const examsListEl = document.getElementById("examsList");
  const emptyStateEl = document.getElementById("emptyState");
  const studentNameEl = document.getElementById("studentName");
  const roleBadgeEl = document.getElementById("roleBadge");
  const logoutBtn = document.getElementById("logoutBtn");

  // 1. Load current user from localStorage
  const userJson = localStorage.getItem("examApp_currentUser");
  if (!userJson) {
    window.location.href = "login.html";
    return;
  }

  const currentUser = JSON.parse(userJson);

  // Only students allowed here
  if (currentUser.role !== "student") {
    window.location.href = "login.html";
    return;
  }

  // Header text
  studentNameEl.textContent = `Hello, ${currentUser.fullname} (Student)`;
  roleBadgeEl.textContent = "Student";

  // 2. Get summaries source (from fakeData.js, or fallback demo)
  const summariesSource =
    typeof studentExamSummaries !== "undefined" &&
    Array.isArray(studentExamSummaries) &&
    studentExamSummaries.length > 0
      ? studentExamSummaries
      : buildDemoSummaries(currentUser);

  // Filter by studentId if exists, otherwise by username
  const mySummaries = summariesSource.filter((s) => {
    if (currentUser.studentId) {
      return s.studentId === currentUser.studentId;
    }
    return s.username === currentUser.username;
  });

  if (!mySummaries.length) {
    emptyStateEl.classList.remove("hidden");
    return;
  }

  emptyStateEl.classList.add("hidden");

  // Sort by date (descending)
  mySummaries.sort((a, b) => (a.date > b.date ? -1 : 1));

  mySummaries.forEach((summary) => {
    const card = buildExamCard(summary);
    examsListEl.appendChild(card);
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("examApp_currentUser");
    window.location.href = "login.html";
  });
});

// Build exam card
function buildExamCard(summary) {
  const card = document.createElement("article");
  card.className =
    "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition";

  const statusColor = getStatusColor(summary.status || "Completed");
  const incidentsCount = (summary.incidents && summary.incidents.length) || 0;

  const incidentsHTML =
    incidentsCount > 0
      ? `<ul class="list-disc list-inside text-xs text-slate-700 space-y-1">
          ${summary.incidents.map((i) => `<li>${i}</li>`).join("")}
        </ul>`
      : `<p class="text-xs text-slate-400 italic">No incidents or exceptions were recorded.</p>`;

  const timeline = buildTimeline(summary);
  const timelineHTML = timeline
    .map(
      (item) => `
      <div class="relative pl-6">
        <div class="absolute left-0 top-1.5 w-2 h-2 rounded-full ${
          item.type === "incident"
            ? "bg-red-500"
            : item.type === "exit"
            ? "bg-amber-500"
            : item.type === "return"
            ? "bg-emerald-500"
            : "bg-slate-400"
        }"></div>
        <p class="text-[11px] text-slate-500">${item.time}</p>
        <p class="text-xs text-slate-800">${item.label}</p>
      </div>
    `
    )
    .join("");

  card.innerHTML = `
    <!-- Top row -->
    <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h3 class="text-sm font-semibold text-slate-900">
          ${summary.courseName || "Exam"}
        </h3>
        <p class="text-xs text-slate-500">
          ${summary.date || ""} • ${summary.room || ""}
        </p>
        ${
          summary.examId
            ? `<p class="text-[11px] text-slate-400 mt-0.5">Exam ID: ${summary.examId}</p>`
            : ""
        }
      </div>

      <div class="flex flex-col items-end gap-1">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${statusColor.bg} ${statusColor.text}">
          ${summary.status || "Completed"}
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600">
          ⏱ Extra time: ${(summary.extraTimeMinutes || 0)} min
        </span>
      </div>
    </div>

    <!-- Middle row: times + numbers -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-xs">
      <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <p class="text-[11px] font-semibold text-slate-500 mb-1">Time</p>
        <p class="text-xs text-slate-800">
          <span class="font-medium">Arrival:</span> ${summary.arrivalTime || "-"}
        </p>
        <p class="text-xs text-slate-800">
          <span class="font-medium">Finish:</span> ${summary.finishTime || "-"}
        </p>
      </div>

      <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <p class="text-[11px] font-semibold text-slate-500 mb-1">Status</p>
        <p class="text-xs text-slate-800">
          <span class="font-medium">Extra time:</span> ${summary.extraTimeMinutes || 0} minutes
        </p>
        <p class="text-xs text-slate-800">
          <span class="font-medium">Incidents:</span> ${incidentsCount}
        </p>
      </div>

      <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
        <p class="text-[11px] font-semibold text-slate-500 mb-1">Explanation</p>
        <p class="text-xs text-slate-800">
          This exam summary shows how your exam was recorded: times,
          extra time and any exceptions. You cannot change this data.
        </p>
      </div>
    </div>

    <!-- Bottom row: incidents + timeline -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="bg-white rounded-xl border border-slate-100 p-3">
        <p class="text-[11px] font-semibold text-slate-500 mb-1">
          Incidents & exceptions
        </p>
        ${incidentsHTML}
      </div>

      <div class="bg-white rounded-xl border border-slate-100 p-3">
        <p class="text-[11px] font-semibold text-slate-500 mb-1">
          Timeline – what happened?
        </p>
        <div class="space-y-1.5 mt-1">
          ${timelineHTML}
        </div>
      </div>
    </div>
  `;

  return card;
}

function buildTimeline(summary) {
  if (Array.isArray(summary.timeline) && summary.timeline.length > 0) {
    return summary.timeline;
  }

  const timeline = [];

  if (summary.arrivalTime) {
    timeline.push({
      time: summary.arrivalTime,
      label: "Arrived to the exam room and checked in.",
      type: "arrival"
    });
  }

  timeline.push({
    time: approxPlus(summary.arrivalTime || "09:00", 5),
    label: "Exam started.",
    type: "info"
  });

  if (Array.isArray(summary.incidents)) {
    summary.incidents.forEach((incText) => {
      const timeMatch = incText.match(/(\d{1,2}:\d{2})/);
      timeline.push({
        time: timeMatch ? timeMatch[1] : "",
        label: incText,
        type: incText.toLowerCase().includes("exit")
          ? "exit"
          : "incident"
      });
    });
  }

  if (summary.finishTime) {
    timeline.push({
      time: summary.finishTime,
      label: "Exam finished and exam booklets handed in.",
      type: "finish"
    });
  }

  return timeline;
}

function getStatusColor(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("completed") || s.includes("ok")) {
    return { bg: "bg-emerald-100", text: "text-emerald-700" };
  }
  if (s.includes("cancelled") || s.includes("failed")) {
    return { bg: "bg-red-100", text: "text-red-700" };
  }
  if (s.includes("in progress")) {
    return { bg: "bg-amber-100", text: "text-amber-700" };
  }
  return { bg: "bg-slate-100", text: "text-slate-600" };
}

function approxPlus(timeStr, minutesToAdd) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr;
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;

  m += minutesToAdd;
  while (m >= 60) {
    m -= 60;
    h += 1;
  }
  if (h >= 24) h -= 24;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// fallback demo if no studentExamSummaries in fakeData.js
function buildDemoSummaries(currentUser) {
  return [
    {
      studentId: currentUser.studentId || "S001",
      username: currentUser.username,
      examId: 999,
      courseName: "Demo Exam – Data Structures",
      date: "2025-12-01",
      room: "Room 101",
      arrivalTime: "09:03",
      finishTime: "11:58",
      status: "Completed",
      extraTimeMinutes: 10,
      incidents: [
        "Late arrival: 3 minutes",
        "Temporary exit to restroom at 10:25 (6 minutes)"
      ]
    }
  ];
}
