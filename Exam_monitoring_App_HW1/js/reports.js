// reports.js
// Reports & History screen – simple, clear and role-aware
// Data here is a simulation of the last exams history.

let reportsChart = null;

/* ---------- Helpers ---------- */

function fillUserInfoReports(currentUser) {
  const fullName = currentUser.fullname || currentUser.username;
  const role = (currentUser.role || "").toLowerCase();

  const userFullNameEl = document.getElementById("userFullName");
  const userRoleEl = document.getElementById("userRole");
  const currentDateEl = document.getElementById("currentDate");
  const viewRoleBadge = document.getElementById("viewRoleBadge");

  if (userFullNameEl) userFullNameEl.textContent = fullName;

  let niceRole =
    role === "supervisor"
      ? "Supervisor"
      : role === "lecturer"
      ? "Lecturer"
      : role === "admin"
      ? "System Admin"
      : role || "user";

  if (userRoleEl) userRoleEl.textContent = niceRole.toUpperCase();
  if (viewRoleBadge) {
    viewRoleBadge.textContent =
      role === "lecturer"
        ? "Lecturer – course level view"
        : role === "supervisor"
        ? "Supervisor – room level view"
        : "Generic view";
  }

  if (currentDateEl) {
    if (typeof TODAY !== "undefined") {
      currentDateEl.textContent = `Today: ${TODAY}`;
    } else {
      const today = new Date();
      currentDateEl.textContent =
        "Today: " +
        today.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
    }
  }
}

function createTag(text, colorClasses) {
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colorClasses}">
    ${text}
  </span>`;
}

/* ---------- Fake reports data (simulation) ---------- */

// In a real system this comes from the database / audit logs.
// Here we create 10 exams with simple numbers that are easy to understand.
const examHistory = [
  {
    examId: 1,
    date: "2025-01-15",
    courseCode: "CS101",
    courseName: "Intro to Programming",
    room: "B101",
    building: "Main",
    lecturerName: "Naomi Cohen",
    registered: 60,
    present: 54,
    late: 5,
    tempOut: 8,
    incidents: 3,
    cancelled: 0,
  },
  {
    examId: 2,
    date: "2025-01-20",
    courseCode: "MATH201",
    courseName: "Linear Algebra",
    room: "B203",
    building: "Main",
    lecturerName: "Dr. Vered",
    registered: 45,
    present: 40,
    late: 4,
    tempOut: 5,
    incidents: 1,
    cancelled: 0,
  },
  {
    examId: 3,
    date: "2025-02-02",
    courseCode: "CS204",
    courseName: "Data Structures",
    room: "C001",
    building: "Labs",
    lecturerName: "Reuven",
    registered: 55,
    present: 50,
    late: 3,
    tempOut: 10,
    incidents: 2,
    cancelled: 1,
  },
  {
    examId: 4,
    date: "2025-02-15",
    courseCode: "PHYS101",
    courseName: "Physics 1",
    room: "A110",
    building: "North",
    lecturerName: "Dr. Sari",
    registered: 70,
    present: 65,
    late: 6,
    tempOut: 9,
    incidents: 4,
    cancelled: 0,
  },
  {
    examId: 5,
    date: "2025-03-01",
    courseCode: "CS305",
    courseName: "Operating Systems",
    room: "Lab 3",
    building: "Labs",
    lecturerName: "Naomi Cohen",
    registered: 40,
    present: 34,
    late: 3,
    tempOut: 4,
    incidents: 2,
    cancelled: 0,
  },
  {
    examId: 6,
    date: "2025-03-10",
    courseCode: "STAT101",
    courseName: "Statistics",
    room: "B105",
    building: "Main",
    lecturerName: "Dr. Amir",
    registered: 80,
    present: 70,
    late: 7,
    tempOut: 12,
    incidents: 5,
    cancelled: 1,
  },
  {
    examId: 7,
    date: "2025-03-25",
    courseCode: "CS210",
    courseName: "Algorithms",
    room: "C020",
    building: "South",
    lecturerName: "Reuven",
    registered: 50,
    present: 45,
    late: 4,
    tempOut: 6,
    incidents: 1,
    cancelled: 0,
  },
  {
    examId: 8,
    date: "2025-04-05",
    courseCode: "ENG101",
    courseName: "Technical English",
    room: "A220",
    building: "North",
    lecturerName: "Naomi Cohen",
    registered: 35,
    present: 33,
    late: 1,
    tempOut: 3,
    incidents: 0,
    cancelled: 0,
  },
  {
    examId: 9,
    date: "2025-04-20",
    courseCode: "CS330",
    courseName: "Software Testing",
    room: "Lab 1",
    building: "Labs",
    lecturerName: "Reuven",
    registered: 42,
    present: 36,
    late: 3,
    tempOut: 7,
    incidents: 3,
    cancelled: 0,
  },
  {
    examId: 10,
    date: "2025-05-02",
    courseCode: "CS340",
    courseName: "Cloud Computing",
    room: "Lab 2",
    building: "Labs",
    lecturerName: "Naomi Cohen",
    registered: 48,
    present: 44,
    late: 2,
    tempOut: 5,
    incidents: 1,
    cancelled: 0,
  },
];

// Example of "saved events" log – short text per event.
const logEvents = [
  {
    time: "2025-03-10 10:15",
    exam: "STAT101",
    type: "Long bathroom exit",
    description: "Student 3156789 was out of room for 16 minutes (supervisor confirmed).",
  },
  {
    time: "2025-02-02 09:30",
    exam: "CS204",
    type: "Exam cancelled",
    description: "Exam of student 2045678 was cancelled due to cheating.",
  },
  {
    time: "2025-01-15 09:05",
    exam: "CS101",
    type: "Late arrivals",
    description: "5 late arrivals – system marked them automatically as 'late'.",
  },
  {
    time: "2025-02-15 10:50",
    exam: "PHYS101",
    type: "Early leaves",
    description: "3 students left more than 30 minutes before the end of the exam.",
  },
  {
    time: "2025-04-20 09:40",
    exam: "CS330",
    type: "ID verification",
    description: "ID mismatch detected and resolved by supervisor.",
  },
  {
    time: "2025-03-25 10:00",
    exam: "CS210",
    type: "Support message",
    description: "Lecturer requested extra 15 minutes for 2 students with accommodations.",
  },
];

/* ---------- Filtering & stats ---------- */

function applyFilters(exams, filterCountValue, filterTypeValue, searchCourseValue) {
  let data = [...exams];

  // Sort by date ASC (old → new) so we can safely take "last 10"
  data.sort((a, b) => a.date.localeCompare(b.date));

  if (filterTypeValue === "lowAttendance") {
    data = data.filter((ex) => (ex.present / ex.registered) * 100 < 80);
  } else if (filterTypeValue === "highIncidents") {
    data = data.filter((ex) => ex.incidents >= 3);
  }

  if (searchCourseValue) {
    const q = searchCourseValue.toLowerCase();
    data = data.filter((ex) => ex.courseCode.toLowerCase().includes(q));
  }

  if (filterCountValue !== "all") {
    const n = Number(filterCountValue);
    if (!Number.isNaN(n)) {
      data = data.slice(-n); // last n exams
    }
  } else {
    data = data.slice(-20); // just in case in future there are more exams
  }

  return data;
}

function calcStats(data) {
  if (!data.length) {
    return {
      examsCount: 0,
      avgAttendance: 0,
      avgLate: 0,
      avgIncidents: 0,
    };
  }

  let totalRegistered = 0;
  let totalPresent = 0;
  let totalLate = 0;
  let totalIncidents = 0;

  data.forEach((ex) => {
    totalRegistered += ex.registered;
    totalPresent += ex.present;
    totalLate += ex.late;
    totalIncidents += ex.incidents;
  });

  const examsCount = data.length;
  const avgAttendance =
    totalRegistered > 0 ? (totalPresent / totalRegistered) * 100 : 0;
  const avgLate = totalLate / examsCount;
  const avgIncidents = totalIncidents / examsCount;

  return {
    examsCount,
    avgAttendance,
    avgLate,
    avgIncidents,
  };
}

/* ---------- Render functions ---------- */

function renderKpis(stats) {
  const kpiExamsCount = document.getElementById("kpiExamsCount");
  const kpiAvgAttendance = document.getElementById("kpiAvgAttendance");
  const kpiAvgLate = document.getElementById("kpiAvgLate");
  const kpiAvgIncidents = document.getElementById("kpiAvgIncidents");

  if (kpiExamsCount) kpiExamsCount.textContent = stats.examsCount;
  if (kpiAvgAttendance)
    kpiAvgAttendance.textContent = `${stats.avgAttendance.toFixed(1)}%`;
  if (kpiAvgLate) kpiAvgLate.textContent = stats.avgLate.toFixed(1);
  if (kpiAvgIncidents)
    kpiAvgIncidents.textContent = stats.avgIncidents.toFixed(1);
}

function renderTable(data) {
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="10" class="px-3 py-3 text-center text-sm text-slate-500">
        No exams match the current filters.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  data.forEach((ex) => {
    const tr = document.createElement("tr");

    const attendanceRate =
      ex.registered > 0 ? (ex.present / ex.registered) * 100 : 0;

    let attTag = createTag(
      `${attendanceRate.toFixed(1)}%`,
      attendanceRate >= 90
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : attendanceRate >= 80
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-rose-50 text-rose-700 border border-rose-200"
    );

    let incidentsTag =
      ex.incidents === 0
        ? createTag(
            "No incidents",
            "bg-emerald-50 text-emerald-700 border border-emerald-200"
          )
        : createTag(
            `${ex.incidents} incident(s)`,
            ex.incidents >= 3
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          );

    const cancelledTag =
      ex.cancelled > 0
        ? createTag(
            `${ex.cancelled} cancelled`,
            "bg-rose-50 text-rose-700 border border-rose-200"
          )
        : createTag(
            "0",
            "bg-slate-50 text-slate-600 border border-slate-200"
          );

    tr.innerHTML = `
      <td class="px-3 py-2 whitespace-nowrap text-slate-800">${ex.date}</td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">
        <span class="font-semibold">${ex.courseCode}</span>
        <span class="text-[11px] text-slate-400 block">${ex.courseName}</span>
      </td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">
        ${ex.building}, ${ex.room}
        <span class="block text-[11px] text-slate-400">Lecturer: ${
          ex.lecturerName
        }</span>
      </td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">${ex.registered}</td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">${ex.present}</td>
      <td class="px-3 py-2 whitespace-nowrap">
        ${attTag}
      </td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">${ex.late}</td>
      <td class="px-3 py-2 whitespace-nowrap text-slate-700">${ex.tempOut}</td>
      <td class="px-3 py-2 whitespace-nowrap">
        ${incidentsTag}
      </td>
      <td class="px-3 py-2 whitespace-nowrap">
        ${cancelledTag}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function renderLog() {
  const list = document.getElementById("logList");
  if (!list) return;

  list.innerHTML = "";

  logEvents.forEach((ev) => {
    const li = document.createElement("li");
    li.className =
      "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs flex flex-col gap-0.5";

    li.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-semibold text-slate-800">${ev.exam}</span>
        <span class="text-[11px] text-slate-400">${ev.time}</span>
      </div>
      <div class="flex items-center gap-2">
        ${createTag(ev.type, "bg-sky-50 text-sky-700 border border-sky-200")}
      </div>
      <p class="text-[11px] text-slate-600 mt-1">
        ${ev.description}
      </p>
    `;

    list.appendChild(li);
  });
}

function renderChart(data) {
  const ctx = document.getElementById("reportsChart");
  if (!ctx) return;

  const labels = data.map((ex) => `${ex.date} • ${ex.courseCode}`);
  const attendanceValues = data.map((ex) =>
    ex.registered > 0 ? ((ex.present / ex.registered) * 100).toFixed(1) : 0
  );
  const incidentsValues = data.map((ex) => ex.incidents);

  if (reportsChart) {
    reportsChart.destroy();
  }

  reportsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Attendance rate (%)",
          data: attendanceValues,
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "Incidents (count)",
          data: incidentsValues,
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            callback: (value) => value + "%",
          },
          title: {
            display: true,
            text: "Attendance (%)",
          },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          title: {
            display: true,
            text: "Incidents",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            font: {
              size: 11,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.datasetIndex === 0) {
                return `Attendance: ${ctx.formattedValue}%`;
              } else {
                return `Incidents: ${ctx.formattedValue}`;
              }
            },
          },
        },
      },
    },
  });
}

/* ---------- NEW: Download report per exam (simulation) ---------- */

function downloadFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildExamReportText(exam) {
  const attendanceRate =
    exam.registered > 0 ? (exam.present / exam.registered) * 100 : 0;

  return [
    "Exam Monitoring App – Report (Simulation)",
    "-----------------------------------------",
    "",
    `Course:        ${exam.courseCode} – ${exam.courseName}`,
    `Lecturer:      ${exam.lecturerName}`,
    `Date:          ${exam.date}`,
    `Room:          ${exam.building}, ${exam.room}`,
    "",
    `Registered:    ${exam.registered}`,
    `Present:       ${exam.present}`,
    `Late:          ${exam.late}`,
    `Temp exits:    ${exam.tempOut}`,
    `Incidents:     ${exam.incidents}`,
    `Cancelled:     ${exam.cancelled}`,
    "",
    `Attendance:    ${attendanceRate.toFixed(1)}%`,
    "",
    "This file is created as a simple fake report for demo / screenshots.",
  ].join("\n");
}

function downloadExamAsPdf(exam) {
  // Very simple text-based "PDF" content – good enough for fake demo and download.
  const textBody = buildExamReportText(exam);
  const pdfLike = `%PDF-1.4\n% Fake PDF for demo only\n\n${textBody}\n`;
  const safeCourse = (exam.courseCode || "Exam").replace(/\s+/g, "_");
  const filename = `ExamReport_${safeCourse}_${exam.date}.pdf`;
  downloadFile(filename, "application/pdf", pdfLike);
}

function downloadExamAsExcel(exam) {
  // Use CSV – opens in Excel, enough for simulation
  const header = [
    "Date",
    "Course Code",
    "Course Name",
    "Room",
    "Registered",
    "Present",
    "Late",
    "TempExits",
    "Incidents",
    "Cancelled",
  ].join(",");

  const row = [
    exam.date,
    exam.courseCode,
    `"${exam.courseName}"`,
    `"${exam.building} ${exam.room}"`,
    exam.registered,
    exam.present,
    exam.late,
    exam.tempOut,
    exam.incidents,
    exam.cancelled,
  ].join(",");

  const csv = header + "\n" + row + "\n" +
    "\nNote: This file is a simple CSV used only for demo / screenshots.";
  const safeCourse = (exam.courseCode || "Exam").replace(/\s+/g, "_");
  const filename = `ExamReport_${safeCourse}_${exam.date}.csv`;
  downloadFile(filename, "text/csv;charset=utf-8;", csv);
}

function setupDownloadControls() {
  const selectEl = document.getElementById("downloadExamSelect");
  const btnPdf = document.getElementById("btnDownloadPdf");
  const btnExcel = document.getElementById("btnDownloadExcel");

  if (!selectEl || !btnPdf || !btnExcel) return;

  // Placeholder option
  selectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select exam…";
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  // Fill with all exams from history
  examHistory.forEach((ex) => {
    const opt = document.createElement("option");
    opt.value = String(ex.examId);
    opt.textContent = `${ex.date} • ${ex.courseCode} • ${ex.room}`;
    selectEl.appendChild(opt);
  });

  function getSelectedExam() {
    const id = Number(selectEl.value);
    if (!id) {
      alert("Please select an exam first.");
      return null;
    }
    const exam = examHistory.find((e) => e.examId === id);
    if (!exam) {
      alert("Exam not found in history (simulation).");
      return null;
    }
    return exam;
  }

  btnPdf.addEventListener("click", () => {
    const exam = getSelectedExam();
    if (!exam) return;
    downloadExamAsPdf(exam);
  });

  btnExcel.addEventListener("click", () => {
    const exam = getSelectedExam();
    if (!exam) return;
    downloadExamAsExcel(exam);
  });
}

/* ---------- Main ---------- */

document.addEventListener("DOMContentLoaded", () => {
  // 1. User from localStorage
  const rawUser = localStorage.getItem("examApp_currentUser");
  if (!rawUser) {
    window.location.href = "login.html";
    return;
  }
  const currentUser = JSON.parse(rawUser);
  fillUserInfoReports(currentUser);

  // 2. Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("examApp_currentUser");
      window.location.href = "login.html";
    });
  }

  // 3. DOM elements for filters
  const filterCountEl = document.getElementById("filterCount");
  const filterTypeEl = document.getElementById("filterType");
  const searchCourseEl = document.getElementById("searchCourse");

  function rerender() {
    const filterCountValue = filterCountEl ? filterCountEl.value : "10";
    const filterTypeValue = filterTypeEl ? filterTypeEl.value : "all";
    const searchCourseValue = searchCourseEl
      ? searchCourseEl.value.trim()
      : "";

    const filteredData = applyFilters(
      examHistory,
      filterCountValue,
      filterTypeValue,
      searchCourseValue
    );

    const stats = calcStats(filteredData);
    renderKpis(stats);
    renderTable(filteredData);
    renderChart(filteredData);
  }

  if (filterCountEl) filterCountEl.addEventListener("change", rerender);
  if (filterTypeEl) filterTypeEl.addEventListener("change", rerender);
  if (searchCourseEl)
    searchCourseEl.addEventListener("input", () => {
      rerender();
    });

  // 4. Log
  renderLog();

  // 5. Initial render
  rerender();

  // 6. Setup download controls (PDF / Excel)
  setupDownloadControls();
});
