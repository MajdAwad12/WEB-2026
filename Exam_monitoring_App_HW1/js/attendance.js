// attendance.js
// Shared attendance screen –
//  - Supervisor: can change statuses, exits, QR simulation, cancel exam
//  - Lecturer:   read-only view (buttons disabled) with pre-simulated data
// Data is loaded from fakeData.js (TODAY, exams, students, examRegistrations, fakeAccounts, currentExamStatus)

const activeExitTimers = {}; // key: index, value: setInterval id

/* --------- UI helpers --------- */

function fillUserInfoAttendance(currentUser) {
  const fullName = currentUser.fullname || currentUser.username;
  const role = (currentUser.role || "").toLowerCase();

  const userFullNameEl = document.getElementById("userFullName");
  const userRoleEl = document.getElementById("userRole");
  const headerUserNameEl = document.getElementById("headerUserName");
  const headerSubtitleEl = document.getElementById("headerUserSubtitle");
  const currentDateEl = document.getElementById("currentDate");

  if (userFullNameEl) userFullNameEl.textContent = fullName;
  if (headerUserNameEl) headerUserNameEl.textContent = fullName;

  let niceRole =
    role === "supervisor"
      ? "Supervisor"
      : role === "lecturer"
      ? "Lecturer"
      : role === "admin"
      ? "System Admin"
      : role || "user";

  if (userRoleEl) userRoleEl.textContent = niceRole.toUpperCase();
  if (headerSubtitleEl) headerSubtitleEl.textContent = `Role: ${niceRole}`;

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

function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStatusClasses(status) {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "Out Of Room":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "Absent":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    case "Not Arrived":
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200 border";
  }
}

function getDotClasses(status) {
  switch (status) {
    case "Present":
      return "bg-emerald-500";
    case "Out Of Room":
      return "bg-amber-500";
    case "Absent":
      return "bg-rose-500";
    case "Not Arrived":
    default:
      return "bg-slate-400";
  }
}

/* --------- MAIN --------- */

document.addEventListener("DOMContentLoaded", () => {
  // 1. User from localStorage – MUST match dashboard.js
  const rawUser = localStorage.getItem("examApp_currentUser");
  if (!rawUser) {
    window.location.href = "login.html";
    return;
  }
  const currentUser = JSON.parse(rawUser);
  fillUserInfoAttendance(currentUser);

  const role = (currentUser.role || "").toLowerCase();
  const isSupervisor = role === "supervisor";
  const isLecturer = role === "lecturer";

  // 2. Logout button – remove same keys used everywhere
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("examApp_currentUser");
      localStorage.removeItem("examApp_attendanceExam");
      window.location.href = "login.html";
    });
  }

  // 3. DOM elements
  const tableBody = document.getElementById("studentsTableBody");
  const examInfoEl = document.getElementById("examShortInfo");

  const countPresentEl = document.getElementById("countPresent");
  const countOutEl = document.getElementById("countOut");
  const countAbsentEl = document.getElementById("countAbsent");
  const countNotArrivedEl = document.getElementById("countNotArrived");

  const btnMarkAllPresent = document.getElementById("btnMarkAllPresent");
  const btnResetAll = document.getElementById("btnResetAll");

  const scanSelect = document.getElementById("scanStudentSelect");
  const btnScanSim = document.getElementById("btnScanSim");
  const scanInfo = document.getElementById("scanInfo");

  if (!tableBody) {
    console.error("studentsTableBody not found in DOM");
    return;
  }

  // 4. Check fakeData.js is loaded
  if (typeof exams === "undefined" || !Array.isArray(exams)) {
    console.error("exams is not defined or not an array in fakeData.js");
    if (examInfoEl) {
      examInfoEl.innerHTML = `<span class="text-red-600 text-sm">
        Error: exams array is missing from fakeData.js
      </span>`;
    }
    return;
  }

  if (typeof students === "undefined" || !Array.isArray(students)) {
    console.error("students is not defined or not an array in fakeData.js");
    if (examInfoEl) {
      examInfoEl.innerHTML = `<span class="text-red-600 text-sm">
        Error: students array is missing from fakeData.js
      </span>`;
    }
    return;
  }

  if (typeof examRegistrations === "undefined") {
    console.error("examRegistrations is not defined in fakeData.js");
    if (examInfoEl) {
      examInfoEl.innerHTML = `<span class="text-red-600 text-sm">
        Error: examRegistrations is missing from fakeData.js
      </span>`;
    }
    return;
  }

  // 5. Choose active exam
  let activeExam = null;

  const rawAttendanceExam = localStorage.getItem("examApp_attendanceExam");
  if (rawAttendanceExam) {
    try {
      const attExam = JSON.parse(rawAttendanceExam);
      if (attExam && attExam.examId != null) {
        activeExam = exams.find((e) => e.examId === attExam.examId) || null;
      }
    } catch (e) {
      console.error("Failed to parse examApp_attendanceExam", e);
    }
  }

  if (!activeExam) {
    let activeExamId = null;

    if (typeof currentExamId !== "undefined") {
      activeExamId = currentExamId;
    } else if (typeof currentExamStatus !== "undefined") {
      activeExamId = currentExamStatus.examId;
    } else if (exams[0]) {
      activeExamId = exams[0].examId;
    }

    if (activeExamId != null) {
      activeExam = exams.find((e) => e.examId === activeExamId) || exams[0];
    } else {
      activeExam = exams[0];
    }
  }

  if (!activeExam) {
    if (examInfoEl) {
      examInfoEl.innerHTML = `
        <span class="text-sm text-slate-700 font-semibold">
          No active exam found in fakeData.js.
        </span>`;
    }
    return;
  }

  // 6. Build students list for this exam
  const registeredIds = examRegistrations[activeExam.examId] || [];
  const currentExamStudents = registeredIds.map((id, index) => {
    const st = students.find((s) => s.studentId === id);
    return {
      seat: index + 1,
      id,
      name: st ? st.fullName : `Student ${id}`,
      status: "Not Arrived",
      extraTimeMinutes: 0,
      exits: [],
      currentExitStart: null,
      arrivalTime: null,
      finalExitTime: null,
      isLate: false,
      isEarlyLeave: false,
      isExamCancelled: false,
      violationType: null, // e.g. "RuleViolation"
    };
  });

  // 7. Pre-simulated data for lecturer – so the table is not empty
  function simulateForLecturer() {
    if (!isLecturer) return;
    if (!currentExamStudents.length) return;

    // global incidents array for reports.js
    window.runtimeIncidents = window.runtimeIncidents || [];

    currentExamStudents.forEach((st, i) => {
      // reset
      st.status = "Not Arrived";
      st.arrivalTime = null;
      st.finalExitTime = null;
      st.isLate = false;
      st.isEarlyLeave = false;
      st.isExamCancelled = false;
      st.violationType = null;
      st.exits = [];
      st.currentExitStart = null;
      st.extraTimeMinutes = 0;

      if (i < 18) {
        // Present on time
        st.status = "Present";
        st.arrivalTime = "09:00";
      } else if (i >= 18 && i < 22) {
        // Late arrivals
        st.status = "Present";
        st.arrivalTime = "09:15";
        st.isLate = true;
      } else if (i === 22) {
        // Extra time student
        st.status = "Present";
        st.arrivalTime = "09:00";
        st.extraTimeMinutes = 15;
      } else if (i === 23) {
        // Extra time + late
        st.status = "Present";
        st.arrivalTime = "09:18";
        st.extraTimeMinutes = 25;
        st.isLate = true;
      } else if (i === 24) {
        // Long bathroom exit (finished)
        st.status = "Present";
        st.arrivalTime = "09:02";
        const durationMs = 14 * 60 * 1000; // 14 minutes
        st.exits.push({ start: 0, end: durationMs, durationMs });
      } else if (i === 25) {
        // Out of room (just status, no running timer)
        st.status = "Out Of Room";
        st.arrivalTime = "09:05";
      } else if (i === 26) {
        // Early leave
        st.status = "Absent";
        st.arrivalTime = "09:00";
        st.finalExitTime = "10:30";
        st.isEarlyLeave = true;
      } else {
        // Absent
        st.status = "Absent";
      }
    });

    // Student with exam cancelled (rule violation)
    const violStudent = currentExamStudents[6]; // seat 7 example
    if (violStudent) {
      violStudent.status = "Absent";
      violStudent.isExamCancelled = true;
      violStudent.violationType = "RuleViolation";
      violStudent.finalExitTime = "10:42";

      window.runtimeIncidents.push({
        examId: activeExam.examId,
        courseCode: activeExam.courseCode,
        room: activeExam.room,
        time: "10:42",
        type: "RuleViolation",
        studentId: violStudent.id,
        severity: "high",
        action: "ExamCancelled",
        details: "Cheating – exam cancelled by supervisor (simulation for lecturer view).",
      });
    }
  }

  // 8. Fill exam info header
  if (examInfoEl) {
    let supervisorNames = [];
    if (Array.isArray(activeExam.supervisors) && typeof fakeAccounts !== "undefined") {
      supervisorNames = activeExam.supervisors
        .map((u) => fakeAccounts.find((acc) => acc.username === u))
        .filter(Boolean)
        .map((acc) => acc.fullname);
    }

    const roleBadge = isSupervisor
      ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
           Supervisor view
         </span>`
      : isLecturer
      ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
           Lecturer – read only
         </span>`
      : "";

    examInfoEl.innerHTML = `
      <span class="block text-sm text-slate-700 font-bold mb-1">
        Current Exam – Attendance ${roleBadge}
      </span>
      <span class="block text-sm text-slate-700">
        <span class="font-semibold">Course:</span>
        ${activeExam.courseCode} – ${activeExam.courseName}
      </span>
      <span class="block text-sm text-slate-700">
        <span class="font-semibold">Date:</span>
        ${activeExam.date}
      </span>
      <span class="block text-sm text-slate-700">
        <span class="font-semibold">Room:</span>
        ${activeExam.building}, ${activeExam.room}
      </span>
      <span class="block text-sm text-slate-700">
        <span class="font-semibold">Exam time:</span>
        ${activeExam.startTime}–${activeExam.endTime}
      </span>
      <span class="block text-sm text-slate-700">
        <span class="font-semibold">Supervisors:</span>
        ${supervisorNames.length ? supervisorNames.join(", ") : "To be assigned"}
      </span>
      <span class="block text-sm text-slate-700 mt-1">
        <span class="font-semibold">Total students in list:</span>
        ${currentExamStudents.length}
      </span>
    `;
  }

  // 9. Simulation times (for supervisor actions)
  const simArrivalTimes = ["09:00", "09:03", "09:06", "09:09", "09:12", "09:15", "09:18", "09:21"];
  let simArrivalIndex = 0;

  const simExitTimes = [
    "09:30",
    "09:55",
    "10:00",
    "10:15",
    "10:40",
    "11:00",
    "11:10",
    "11:15",
    "11:23",
    "11:35",
    "11:55",
    "12:00",
  ];
  let simExitIndex = 0;

  function getNextArrivalTime() {
    const t = simArrivalTimes[Math.min(simArrivalIndex, simArrivalTimes.length - 1)];
    simArrivalIndex++;
    return t;
  }

  function getNextExitTime() {
    const t = simExitTimes[Math.min(simExitIndex, simExitTimes.length - 1)];
    simExitIndex++;
    return t;
  }

  // 10. Counters
  function updateCounters() {
    let present = 0;
    let out = 0;
    let absent = 0;
    let notArr = 0;

    currentExamStudents.forEach((st) => {
      switch (st.status) {
        case "Present":
          present++;
          break;
        case "Out Of Room":
          out++;
          break;
        case "Absent":
          absent++;
          break;
        default:
          notArr++;
          break;
      }
    });

    if (countPresentEl) countPresentEl.textContent = present;
    if (countOutEl) countOutEl.textContent = out;
    if (countAbsentEl) countAbsentEl.textContent = absent;
    if (countNotArrivedEl) countNotArrivedEl.textContent = notArr;
  }

  // 11. QR / Scan select
  function populateScanSelect() {
    if (!scanSelect) return;
    scanSelect.innerHTML = "";
    currentExamStudents.forEach((st, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = `[Seat ${st.seat}] ${st.name} – ${st.id}`;
      scanSelect.appendChild(opt);
    });
  }

  // 12. Timer for "Out Of Room"
  function startTimerFor(index) {
    if (activeExitTimers[index]) return;

    const timerEl = document.getElementById(`exitTimer-${index}`);
    if (!timerEl) return;

    function tick() {
      const st = currentExamStudents[index];
      if (!st || !st.currentExitStart) {
        clearInterval(activeExitTimers[index]);
        delete activeExitTimers[index];
        return;
      }
      const diffMs = Date.now() - st.currentExitStart;
      timerEl.textContent = formatDuration(diffMs);
    }

    tick();
    activeExitTimers[index] = setInterval(tick, 1000);
  }

  // 13. Render table
  function renderTable() {
    tableBody.innerHTML = "";

    currentExamStudents.forEach((student, index) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition";
      tr.dataset.index = index;

      const statusClasses = getStatusClasses(student.status);
      const dotClasses = getDotClasses(student.status);

      const extraTime = student.extraTimeMinutes || 0;
      const extraTimeBadge = extraTime
        ? `<span class="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
             +${extraTime} min
           </span>`
        : "";

      const exitsCount = student.exits ? student.exits.length : 0;
      let lastExitInfoText = "No exits yet";
      if (exitsCount > 0) {
        const last = student.exits[exitsCount - 1];
        lastExitInfoText = `Exits: ${exitsCount}, Last: ${formatDuration(last.durationMs)}`;
      }

      const hasOngoingExit = !!student.currentExitStart;

      const exceptionLabels = [];
      if (student.isLate) exceptionLabels.push("Late arrival");
      if (student.isEarlyLeave) exceptionLabels.push("Early leave");
      if (student.exits && student.exits.some((e) => e.durationMs > 10 * 60 * 1000)) {
        exceptionLabels.push("Long bathroom exit");
      }
      if (student.isExamCancelled) exceptionLabels.push("Exam cancelled");

      const exceptionsHtml = exceptionLabels.length
        ? `<div class="flex flex-wrap gap-1 mb-1">
             ${exceptionLabels
               .map(
                 (lbl) => `
                 <span class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">
                   ${lbl}
                 </span>
               `
               )
               .join("")}
           </div>`
        : `<span class="text-[11px] text-slate-400 mb-1 block">No exceptions</span>`;

      const disabledClass = isLecturer ? "opacity-40 cursor-not-allowed" : "";

      const violationButtonsHtml = isSupervisor
        ? `
        <div class="flex flex-wrap gap-1 mt-1">
          <button
            class="px-2 py-1 text-[11px] rounded-full border border-rose-300 text-rose-700 hover:bg-rose-50"
            data-violation-btn="cancel"
          >
            Cancel exam
          </button>
        </div>`
        : "";

      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap text-slate-800">${student.seat}</td>
        <td class="px-3 py-2 whitespace-nowrap text-slate-700">${student.id}</td>
        <td class="px-3 py-2 whitespace-nowrap text-slate-700">
          ${student.name}
          ${extraTimeBadge}
          <div class="text-[11px] text-slate-400">
            Entry: ${student.arrivalTime || "--:--"} | Exit: ${student.finalExitTime || "--:--"}
          </div>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusClasses}">
            <span class="w-1.5 h-1.5 rounded-full mr-1 ${dotClasses}"></span>
            <span>${student.status}</span>
          </span>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          <div class="flex flex-wrap gap-1">
            <button class="px-2 py-1 text-xs rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 ${disabledClass}"
                    data-status-btn="Present">
              Present
            </button>
            <button class="px-2 py-1 text-xs rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 ${disabledClass}"
                    data-status-btn="Absent">
              Left the Room
            </button>
            <button class="px-2 py-1 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 ${disabledClass}"
                    data-status-btn="Not Arrived">
              Not Arrived
            </button>
          </div>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          <div class="flex flex-col gap-1 text-xs">
            <button
              class="px-2 py-1 rounded-full border border-amber-300
                     ${hasOngoingExit ? "bg-amber-100 text-amber-800" : "text-amber-700 hover:bg-amber-50"} ${disabledClass}"
              data-out-btn="toggle">
              ${hasOngoingExit ? "Student Back" : "Start Exit"}
            </button>
            <div class="text-[11px] text-slate-500">
              ${lastExitInfoText}
            </div>
            ${
              hasOngoingExit
                ? `<div class="text-[11px] font-mono text-amber-700" id="exitTimer-${index}">
                     00:00
                   </div>`
                : ""
            }
          </div>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          ${exceptionsHtml}
          ${violationButtonsHtml}
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // timers only for supervisor exits
    currentExamStudents.forEach((st, index) => {
      if (st.currentExitStart && !isLecturer) {
        startTimerFor(index);
      } else if (activeExitTimers[index]) {
        clearInterval(activeExitTimers[index]);
        delete activeExitTimers[index];
      }
    });

    updateCounters();
  }

  // 14. Change status – only for supervisor
  function setStudentStatus(index, newStatus) {
    const st = currentExamStudents[index];
    if (!st) return;

    const prevStatus = st.status;
    if (prevStatus === newStatus) {
      renderTable();
      return;
    }

    // first arrival
    if (newStatus === "Present" && !st.arrivalTime) {
      st.arrivalTime = getNextArrivalTime();
      const lateThreshold = "09:10";
      if (st.arrivalTime > lateThreshold) {
        st.isLate = true;
      }
    }

    // final exit
    if (prevStatus === "Present" && newStatus === "Absent") {
      if (!st.finalExitTime) {
        st.finalExitTime = getNextExitTime();
      }
      const earlyThreshold = "11:00";
      if (st.finalExitTime < earlyThreshold) {
        st.isEarlyLeave = true;
      } else {
        st.isEarlyLeave = false;
      }
    }

    st.status = newStatus;
    renderTable();
  }

  // 15. Handle exam cancellation / clear – supervisor only
  function handleViolationAction(index, action) {
    const st = currentExamStudents[index];
    if (!st) return;

    window.runtimeIncidents = window.runtimeIncidents || [];

    if (action === "cancel") {
      st.isExamCancelled = true;
      st.violationType = "RuleViolation";
      // אם הוא היה נוכח – נסמן כAbsent עם יציאה סופית
      if (st.status === "Present") {
        st.status = "Absent";
        if (!st.finalExitTime) {
          st.finalExitTime = getNextExitTime();
        }
      } else {
        st.status = "Absent";
      }

      window.runtimeIncidents.push({
        examId: activeExam.examId,
        courseCode: activeExam.courseCode,
        room: activeExam.room,
        time: st.finalExitTime || "10:42",
        type: "RuleViolation",
        studentId: st.id,
        severity: "high",
        action: "ExamCancelled",
        details: "Exam cancelled by supervisor due to serious rule violation (simulation).",
      });
    } else if (action === "clear") {
      st.isExamCancelled = false;
      st.violationType = null;
      // אין מחיקה אמיתית מה־array – זה רק דמו, מספיק להראות שהסטודנט נקי
    }

    renderTable();
  }

  // 16. Table events – only supervisor can click
  if (isSupervisor) {
    tableBody.addEventListener("click", (event) => {
      const row = event.target.closest("tr");
      if (!row) return;
      const index = Number(row.dataset.index);
      if (Number.isNaN(index)) return;

      // Out / Bathroom
      const outBtn = event.target.closest("[data-out-btn]");
      if (outBtn) {
        const st = currentExamStudents[index];
        if (!st) return;

        if (st.currentExitStart) {
          const end = Date.now();
          const durationMs = end - st.currentExitStart;
          if (!Array.isArray(st.exits)) st.exits = [];
          st.exits.push({ start: st.currentExitStart, end, durationMs });
          st.currentExitStart = null;
          setStudentStatus(index, "Present");
        } else {
          st.currentExitStart = Date.now();
          setStudentStatus(index, "Out Of Room");
        }
        return;
      }

      // Status buttons
      const btn = event.target.closest("[data-status-btn]");
      if (btn) {
        const newStatus = btn.getAttribute("data-status-btn");
        setStudentStatus(index, newStatus);
        return;
      }

      // Violation buttons (Cancel / Clear)
      const violBtn = event.target.closest("[data-violation-btn]");
      if (violBtn) {
        const action = violBtn.getAttribute("data-violation-btn"); // "cancel" / "clear"
        handleViolationAction(index, action);
        return;
      }
    });
  }

  // 17. Mark all as Present
  if (isSupervisor && btnMarkAllPresent) {
    btnMarkAllPresent.addEventListener("click", () => {
      currentExamStudents.forEach((st, i) => {
        st.status = "Present";
        st.currentExitStart = null;
        if (!st.arrivalTime) {
          st.arrivalTime = getNextArrivalTime();
        }
        st.isLate = false;
        st.isEarlyLeave = false;
        st.isExamCancelled = false;
        st.violationType = null;
        if (activeExitTimers[i]) {
          clearInterval(activeExitTimers[i]);
          delete activeExitTimers[i];
        }
      });
      renderTable();
    });
  } else if (isLecturer && btnMarkAllPresent) {
    btnMarkAllPresent.disabled = true;
    btnMarkAllPresent.classList.add("opacity-40", "cursor-not-allowed");
  }

  // 18. Reset all
  if (isSupervisor && btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      currentExamStudents.forEach((st, i) => {
        st.status = "Not Arrived";
        st.currentExitStart = null;
        st.exits = [];
        st.arrivalTime = null;
        st.finalExitTime = null;
        st.isLate = false;
        st.isEarlyLeave = false;
        st.isExamCancelled = false;
        st.violationType = null;
        if (activeExitTimers[i]) {
          clearInterval(activeExitTimers[i]);
          delete activeExitTimers[i];
        }
      });
      renderTable();
      if (scanInfo) {
        scanInfo.textContent = "No scan yet (simulation).";
      }
      simArrivalIndex = 0;
      simExitIndex = 0;
    });
  } else if (isLecturer && btnResetAll) {
    btnResetAll.disabled = true;
    btnResetAll.classList.add("opacity-40", "cursor-not-allowed");
  }

  // 19. QR Simulation – only supervisor
  if (isSupervisor && btnScanSim && scanSelect && scanInfo) {
    btnScanSim.addEventListener("click", () => {
      const idx = Number(scanSelect.value);
      if (Number.isNaN(idx)) return;
      const st = currentExamStudents[idx];
      if (!st) return;

      if (st.status === "Present") {
        if (!st.arrivalTime) {
          st.arrivalTime = getNextArrivalTime();
        }
        scanInfo.textContent = `Simulation: ${st.id} – ${st.name} is already Present (entry: ${st.arrivalTime}).`;
        return;
      }

      setStudentStatus(idx, "Present");
      scanInfo.textContent = `Simulation: scanned ${st.id} – ${st.name} at ${st.arrivalTime}.`;
    });
  } else if (isLecturer && btnScanSim) {
    btnScanSim.disabled = true;
    btnScanSim.classList.add("opacity-40", "cursor-not-allowed");
  }

  // 20. Initial rendering
  populateScanSelect();
  simulateForLecturer(); // only affects lecturer; supervisor starts "clean"
  renderTable();
});
