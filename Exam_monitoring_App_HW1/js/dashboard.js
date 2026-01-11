// dashboard.js
// One dashboard for all roles – behavior changes by role (lecturer/supervisor/admin)

document.addEventListener("DOMContentLoaded", () => {
  // ===== 1. Load current user =====
  const rawUser = localStorage.getItem("examApp_currentUser");
  
  if (!rawUser) {
    window.location.href = "login.html";
    return;
  }
  const currentUser = JSON.parse(rawUser);
  const role = currentUser.role;

  // ===== 2. Fill user info (sidebar + header) =====
  const userFullNameEl = document.getElementById("userFullName");
  const userRoleEl = document.getElementById("userRole");
  const headerUserNameEl = document.getElementById("headerUserName");
  const headerUserSubtitleEl = document.getElementById("headerUserSubtitle");
  const currentDateEl = document.getElementById("currentDate");
  const todayDateEl = document.getElementById("todayDate");

  if (userFullNameEl) userFullNameEl.textContent = currentUser.fullname;
  if (headerUserNameEl) headerUserNameEl.textContent = currentUser.fullname || currentUser.username;

  const niceRole =
    role === "supervisor" ? "Supervisor" :
    role === "lecturer"   ? "Lecturer"   :
    role === "admin"      ? "System Admin" : role;

  if (userRoleEl) userRoleEl.textContent = niceRole.toUpperCase();
  if (headerUserSubtitleEl) headerUserSubtitleEl.textContent = `Role: ${niceRole}`;

  if (currentDateEl) currentDateEl.textContent = `Today: ${typeof TODAY !== "undefined" ? TODAY : ""}`;
  if (todayDateEl) todayDateEl.textContent = typeof TODAY !== "undefined" ? TODAY : "";

  // ===== 3. Logout =====
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("examApp_currentUser");
      window.location.href = "login.html";
    });
  }

  // ===== 5. Choose relevant exams for this user =====
  // exams, examRegistrations, currentExamStatus, fakeAccounts, TODAY from fakeData.js
  let relevantExams = [];

  if (role === "lecturer") {
    // כל הבחינות של המרצה היום
    relevantExams = exams.filter(
      ex => ex.lecturerUsername === currentUser.username && ex.date === TODAY
    );
  } else if (role === "supervisor") {
    // כל הכיתות שהמשגיח משובץ אליהן היום
    relevantExams = exams.filter(
      ex => ex.supervisors.includes(currentUser.username) && ex.date === TODAY
    );
  } else if (role === "admin") {
    // אדמין רואה כל בחינה היום
    relevantExams = exams.filter(ex => ex.date === TODAY);
  }

  // אם אין תוצאה – fallback ל־currentExamStatus
  if (relevantExams.length === 0) {
    const fromStatus = exams.find(ex => ex.examId === currentExamStatus.examId);
    if (fromStatus) relevantExams = [fromStatus];
  }

  // exam פעיל בתצוגה
  let activeExam = relevantExams[0] || exams.find(ex => ex.examId === currentExamStatus.examId);
  const currentExamInfoEl = document.getElementById("currentExamInfo");
  const roomTabsEl = document.getElementById("roomTabs");

  // ===== 6. Helper to get full name by username =====
  function getFullNameByUsername(username) {
    if (typeof fakeAccounts === "undefined") return username;
    const acc = fakeAccounts.find(a => a.username === username);
    return acc ? acc.fullname : username;
  }

  // ===== 7. Render exam info (room details) =====
  function renderExamInfo(exam) {
    if (!currentExamInfoEl || !exam) return;

    const registered = examRegistrations[exam.examId] || [];
    const totalStudents = registered.length || currentExamStatus.totalStudents;

    const lecturerName = getFullNameByUsername(exam.lecturerUsername);
    const supervisorNames = exam.supervisors.length
      ? exam.supervisors.map(getFullNameByUsername).join(", ")
      : "Not assigned yet";

    currentExamInfoEl.innerHTML = `
      <p class="text-sm text-slate-800">
        <span class="font-semibold">${exam.courseName}</span>
        <span class="text-[11px] text-slate-500 ml-2">(${exam.courseCode})</span>
      </p>
      <p class="text-sm text-slate-700">
        <span class="font-semibold">Date:</span> ${exam.date}
        &nbsp;•&nbsp;
        <span class="font-semibold">Time:</span> ${exam.startTime}–${exam.endTime}
      </p>
      <p class="text-sm text-slate-700">
        <span class="font-semibold">Room:</span> ${exam.building} – ${exam.room}
      </p>
      <p class="text-sm text-slate-700">
        <span class="font-semibold">Lecturer:</span> ${lecturerName}
      </p>
      <p class="text-sm text-slate-700">
        <span class="font-semibold">Supervisors:</span> ${supervisorNames}
      </p>
      <p class="text-sm text-slate-700 mt-1">
        <span class="font-semibold">Registered students:</span> ${totalStudents}
      </p>
    `;
  }

  // ===== 8. Build room tabs – lecturer sees all rooms, others רואים כיתה אחת =====
  if (role === "lecturer" && relevantExams.length > 1 && roomTabsEl) {
    roomTabsEl.classList.remove("hidden");
    roomTabsEl.innerHTML = "";

    relevantExams.forEach(exam => {
      const btn = document.createElement("button");
      btn.textContent = exam.room;
      btn.className =
        "px-3 py-1.5 rounded-full text-xs border text-slate-600 bg-slate-50 hover:bg-sky-50 hover:border-sky-300";

      if (exam.examId === activeExam.examId) {
        btn.className =
          "px-3 py-1.5 rounded-full text-xs border border-sky-400 bg-sky-100 text-sky-800 font-semibold";
      }

      btn.addEventListener("click", () => {
        activeExam = exam;
        // רענון עיצוב הטאבים
        Array.from(roomTabsEl.children).forEach(child => {
          child.className =
            "px-3 py-1.5 rounded-full text-xs border text-slate-600 bg-slate-50 hover:bg-sky-50 hover:border-sky-300";
        });
        btn.className =
          "px-3 py-1.5 rounded-full text-xs border border-sky-400 bg-sky-100 text-sky-800 font-semibold";
        renderExamInfo(activeExam);
      });

      roomTabsEl.appendChild(btn);
    });
  } else {
    // משגיח/אדמין – לא מציגים tabs, רק כיתה אחת
    if (roomTabsEl) roomTabsEl.classList.add("hidden");
  }

  // Render initial exam info
  if (activeExam) {
    renderExamInfo(activeExam);
  } else if (currentExamInfoEl) {
    currentExamInfoEl.innerHTML = `
      <p class="text-sm text-red-600">
        No active exam found in fakeData.js (check currentExamStatus and exams).
      </p>
    `;
  }

  // ===== 9. Time simulation =====
  const currentTimeEl = document.getElementById("currentTime");
  const remainingTimeEl = document.getElementById("remainingtime");

  if (activeExam && currentTimeEl && remainingTimeEl) {
    const totalMinutes = getMinutesDiff(activeExam.startTime, activeExam.endTime);
    const elapsed = totalMinutes - currentExamStatus.remainingMinutes;
    const simulatedTime = addMinutes(activeExam.startTime, elapsed);

    currentTimeEl.textContent = `${simulatedTime} (simulated)`;
    remainingTimeEl.textContent = `${currentExamStatus.remainingMinutes} min`;
  }

  function getMinutesDiff(startHHmm, endHHmm) {
    const [sh, sm] = startHHmm.split(":").map(Number);
    const [eh, em] = endHHmm.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  function addMinutes(timeHHmm, minutesToAdd) {
    const [h, m] = timeHHmm.split(":").map(Number);
    const total = h * 60 + m + minutesToAdd;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    return `${pad(hh)}:${pad(mm)}`;
  }

  // ===== 10. Charts: Status & Incidents =====
  const present = currentExamStatus.presentCount;
  const tempOut = currentExamStatus.tempOutCount;
  const absent = currentExamStatus.absentCount;
  const total = currentExamStatus.totalStudents;

  const ctxStatus = document.getElementById("statusBar");
  const ctxIncidents = document.getElementById("incidentsBar");

  if (window.Chart && ctxStatus) {
    new Chart(ctxStatus, {
      type: "bar",
      data: {
        labels: ["Present", "Temp. Out", "Absent"],
        datasets: [
          {
            label: "Students",
            data: [present, tempOut, absent],
            backgroundColor: [
              "rgba(16, 185, 129, 0.8)", // green
              "rgba(245, 158, 11, 0.8)", // amber
              "rgba(239, 68, 68, 0.8)"   // red
            ]
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  const incidents = currentExamStatus.incidents || [];
  const incidentCounts = {};
  incidents.forEach(inc => {
    incidentCounts[inc.type] = (incidentCounts[inc.type] || 0) + 1;
  });

  if (window.Chart && ctxIncidents) {
    new Chart(ctxIncidents, {
      type: "bar",
      data: {
        labels: Object.keys(incidentCounts),
        datasets: [
          {
            label: "Incidents",
            data: Object.values(incidentCounts),
            backgroundColor: "rgba(59, 130, 246, 0.8)" // blue
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  // ===== 11. Text summaries =====
  const statusSummaryEl = document.getElementById("statusSummary");
  if (statusSummaryEl) {
    statusSummaryEl.innerHTML = `
      <p>
        <strong>${present}</strong> students are
        <span class="text-emerald-700 font-semibold">present</span>,
        <strong>${tempOut}</strong> are
        <span class="text-amber-700 font-semibold">temporarily out</span>,
        and <strong>${absent}</strong> are
        <span class="text-red-700 font-semibold">absent</span>.
      </p>
      <p class="text-xs text-slate-500 mt-1">
        Total registered: ${total} students.
      </p>
    `;
  }

  const incidentsSummaryEl = document.getElementById("incidentsSummary");
  if (incidentsSummaryEl) {
    const totalIncidents = incidents.length;
    const typesText = Object.entries(incidentCounts)
      .map(([type, count]) => `${type} (${count})`)
      .join(", ") || "No incidents recorded.";

    incidentsSummaryEl.innerHTML = `
      <p><strong>${totalIncidents}</strong> incident(s) recorded in this exam.</p>
      <p class="text-xs text-slate-500 mt-1">
        Types: ${typesText}
      </p>
    `;
  }

  // ===== 12. Alerts =====
  const alertsListEl = document.getElementById("alertsList");
  if (alertsListEl) {
    alertsListEl.innerHTML = "";

    function addAlert(level, title, text) {
      const colors = {
        info:   "border-sky-200 bg-sky-50 text-sky-800",
        warn:   "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-red-200 bg-red-50 text-red-800"
      };
      const icon = { info: "ℹ️", warn: "⚠️", danger: "🚨" }[level];

      const li = document.createElement("li");
      li.className = `rounded-xl border px-4 py-3 flex items-start gap-3 ${colors[level]}`;
      li.innerHTML = `
        <div class="mt-0.5">${icon}</div>
        <div>
          <p class="text-sm font-semibold">${title}</p>
          <p class="text-xs mt-1">${text}</p>
        </div>
      `;
      alertsListEl.appendChild(li);
    }

    // Rule-based alerts
    if (absent > 0) {
      addAlert(
        "warn",
        "Some students are absent",
        `${absent} student(s) are marked as absent. Check if this matches the official list.`
      );
    }

    if (tempOut > 0) {
      addAlert(
        "info",
        "Students currently out of the room",
        `${tempOut} student(s) are on a temporary break (e.g., bathroom).`
      );
    }

    if (currentExamStatus.remainingMinutes <= 15) {
      addAlert(
        "warn",
        "Exam is about to end",
        `Only ${currentExamStatus.remainingMinutes} minutes remaining.`
      );
    }

    // Alerts for each incident
    incidents.forEach(inc => {
      addAlert(
        "info",
        `Incident: ${inc.type}`,
        `[${inc.time}] Student ${inc.studentId} – ${inc.details}`
      );
    });

    if (!alertsListEl.children.length) {
      addAlert(
        "info",
        "No special alerts",
        "Everything looks normal for this exam based on the fake data."
      );
    }
  }

  // ===== 13. Go to Attendance screen with correct exam/room =====
  const navAttendance = document.getElementById("navAttendance");
  if (navAttendance) {
    navAttendance.addEventListener("click", (e) => {
      e.preventDefault();

      if (!activeExam) {
        alert("No active exam to open Attendance. Please check fakeData.js.");
        return;
      }

      // נשמור את המבחן הנוכחי כדי ש-attendance.js ידע מה להציג
      localStorage.setItem(
        "examApp_attendanceExam",
        JSON.stringify({
          examId: activeExam.examId,
          courseName: activeExam.courseName,
          courseCode: activeExam.courseCode,
          date: activeExam.date,
          startTime: activeExam.startTime,
          endTime: activeExam.endTime,
          building: activeExam.building,
          room: activeExam.room
        })
      );

      // מעבר לדף סימון נוכחות
      window.location.href = "attendance.html";
    });
  }
});
