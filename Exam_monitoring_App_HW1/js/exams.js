// exams.js
// Exam Management page – different view for lecturer / supervisor / admin

document.addEventListener("DOMContentLoaded", () => {
  // ===== 1. Load current user =====
  const rawUser = localStorage.getItem("examApp_currentUser");
  if (!rawUser) {
    window.location.href = "login.html";
    return;
  }
  const currentUser = JSON.parse(rawUser);
  const role = currentUser.role;

  // ===== 2. Get DOM elements =====
  const userFullNameEl = document.getElementById("userFullName");
  const userRoleEl = document.getElementById("userRole");
  const currentDateEl = document.getElementById("currentDate");
  const headerSubtitleEl = document.getElementById("headerSubtitle");
  const roleScopeTextEl = document.getElementById("roleScopeText");

  const summaryTotalEl = document.getElementById("summaryTotal");
  const summaryActiveEl = document.getElementById("summaryActive");
  const summaryUpcomingEl = document.getElementById("summaryUpcoming");
  const examsTableBodyEl = document.getElementById("examsTableBody");
  const examsCountLabelEl = document.getElementById("examsCountLabel");
  const emptyStateEl = document.getElementById("emptyState");

  const filterButtons = document.querySelectorAll(".exam-filter-btn");

  // ===== 3. Fill header & sidebar info =====
  if (userFullNameEl) userFullNameEl.textContent = currentUser.fullname;
  const niceRole =
    role === "supervisor" ? "Supervisor" :
    role === "lecturer"   ? "Lecturer"   :
    role === "admin"      ? "System Admin" : role;
  if (userRoleEl) userRoleEl.textContent = niceRole.toUpperCase();
  if (currentDateEl) currentDateEl.textContent = `Today: ${typeof TODAY !== "undefined" ? TODAY : ""}`;

  if (headerSubtitleEl) {
    headerSubtitleEl.textContent = "Manage exams that are assigned to you based on your role.";
  }

  if (roleScopeTextEl) {
    if (role === "lecturer") {
      roleScopeTextEl.textContent =
        "As a lecturer, you can see all exam rooms where your exams are scheduled (today and in the future).";
    } else if (role === "supervisor") {
      roleScopeTextEl.textContent =
        "As a supervisor, you see only the exams and rooms where you are assigned as a proctor.";
    } else if (role === "admin") {
      roleScopeTextEl.textContent =
        "As a system admin, you see all exams in the system (simulation).";
    } else {
      roleScopeTextEl.textContent = "Exams loaded according to your role.";
    }
  }

  // ===== 4. Logout button =====
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("examApp_currentUser");
      window.location.href = "login.html";
    });
  }

  // ===== 5. Filter exams by role =====
  // exams, TODAY from fakeData.js
  let examsForUser = [];

  if (role === "lecturer") {
    examsForUser = exams.filter(ex => ex.lecturerUsername === currentUser.username);
  } else if (role === "supervisor") {
    examsForUser = exams.filter(ex => ex.supervisors.includes(currentUser.username));
  } else if (role === "admin") {
    examsForUser = [...exams];
  }

  // Sort by date, then start time
  examsForUser.sort((a, b) => {
    if (a.date === b.date) {
      return a.startTime.localeCompare(b.startTime);
    }
    return a.date.localeCompare(b.date);
  });

  // ===== 6. Helper: classify exam status (active/upcoming/past) =====
  function classifyExam(exam) {
    if (exam.status === "active" && exam.date === TODAY) {
      return "active";
    }
    if (exam.date > TODAY) {
      return "upcoming";
    }
    if (exam.date < TODAY) {
      return "past";
    }
    // date === TODAY but not active => treat as upcoming
    return "upcoming";
  }

  // ===== 7. Update summary numbers =====
  function updateSummary(list) {
    if (!summaryTotalEl || !summaryActiveEl || !summaryUpcomingEl) return;

    const total = list.length;
    const activeCount = list.filter(ex => classifyExam(ex) === "active").length;
    const upcomingCount = list.filter(ex => classifyExam(ex) === "upcoming").length;

    summaryTotalEl.textContent = total;
    summaryActiveEl.textContent = activeCount;
    summaryUpcomingEl.textContent = upcomingCount;
  }

  // ===== 8. Render exams into the table =====
  function getStatusBadge(exam) {
    const status = classifyExam(exam);
    if (status === "active") {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        ● Active today
      </span>`;
    }
    if (status === "upcoming") {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        ● Upcoming
      </span>`;
    }
    // past
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
      ● Past
    </span>`;
  }

  function getFullNameByUsername(username) {
    if (typeof fakeAccounts === "undefined") return username;
    const acc = fakeAccounts.find(a => a.username === username);
    return acc ? acc.fullname : username;
  }

  function renderExams(list, filterType) {
    if (!examsTableBodyEl || !examsCountLabelEl || !emptyStateEl) return;

    examsTableBodyEl.innerHTML = "";

    let filtered = list;
    if (filterType === "active") {
      filtered = list.filter(ex => classifyExam(ex) === "active");
    } else if (filterType === "upcoming") {
      filtered = list.filter(ex => classifyExam(ex) === "upcoming");
    } else if (filterType === "past") {
      filtered = list.filter(ex => classifyExam(ex) === "past");
    }

    examsCountLabelEl.textContent = `${filtered.length} exam(s) found`;

    if (filtered.length === 0) {
      emptyStateEl.classList.remove("hidden");
      return;
    }
    emptyStateEl.classList.add("hidden");

    filtered.forEach(exam => {
      const tr = document.createElement("tr");

      const lecturerName = getFullNameByUsername(exam.lecturerUsername);
      const supervisorNames = exam.supervisors.length
        ? exam.supervisors.map(getFullNameByUsername).join(", ")
        : "Not assigned";

      tr.innerHTML = `
        <td class="px-6 py-4 align-top">
          <div class="font-semibold text-slate-900">${exam.courseCode}</div>
          <div class="text-xs text-slate-600">${exam.courseName}</div>
        </td>
        <td class="px-6 py-4 align-top text-slate-700">
          <div>${exam.date}</div>
          <div class="text-xs text-slate-500">${exam.startTime}–${exam.endTime}</div>
        </td>
        <td class="px-6 py-4 align-top text-slate-700">
          <div>${exam.building}</div>
          <div class="text-xs text-slate-500">${exam.room}</div>
        </td>
        <td class="px-6 py-4 align-top text-slate-700">
          ${lecturerName}
        </td>
        <td class="px-6 py-4 align-top text-slate-700">
          <div class="max-w-[220px] text-xs">${supervisorNames}</div>
        </td>
        <td class="px-6 py-4 align-top">
          ${getStatusBadge(exam)}
        </td>
        <td class="px-6 py-4 align-top text-right">
          ${renderActions(exam)}
        </td>
      `;

      examsTableBodyEl.appendChild(tr);
    });
  }

  function renderActions(exam) {
    const status = classifyExam(exam);
    const baseBtnClasses =
      "inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm";

    let primary = "";
    let secondary = "";

    if (status === "active") {
      primary = `<button
        class="${baseBtnClasses} bg-sky-600 text-white hover:bg-sky-700 mr-2"
        data-action="open-dashboard"
        data-examid="${exam.examId}"
      >
        Open dashboard
      </button>`;
    } else if (status === "upcoming") {
      primary = `<button
        class="${baseBtnClasses} bg-emerald-600 text-white hover:bg-emerald-700 mr-2"
        data-action="view-details"
        data-examid="${exam.examId}"
      >
        View details
      </button>`;
    } else { // past
      primary = `<button
        class="${baseBtnClasses} bg-slate-600 text-white hover:bg-slate-700 mr-2"
        data-action="view-summary"
        data-examid="${exam.examId}"
      >
        View summary
      </button>`;
    }

    

    return primary + secondary;
  }

  // ===== 9. Initial render =====
  updateSummary(examsForUser);
  renderExams(examsForUser, "all");

  // ===== 10. Filters click handling =====
  let currentFilter = "all";

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");
      currentFilter = filter;

      // reset classes
      filterButtons.forEach(b => {
        b.classList.remove("border-sky-300", "bg-sky-50", "text-sky-800");
        b.classList.remove("border-emerald-300", "bg-emerald-50", "text-emerald-800");
        b.classList.remove("bg-slate-50");
        b.classList.add("bg-white", "border-slate-300", "text-slate-700");
      });

      // highlight selected
      if (filter === "active") {
        btn.classList.remove("bg-white", "border-slate-300", "text-slate-700");
        btn.classList.add("border-emerald-300", "bg-emerald-50", "text-emerald-800");
      } else if (filter === "upcoming") {
        btn.classList.remove("bg-white", "border-slate-300", "text-slate-700");
        btn.classList.add("border-sky-300", "bg-sky-50", "text-sky-800");
      } else if (filter === "past") {
        btn.classList.remove("bg-white", "border-slate-300", "text-slate-700");
        btn.classList.add("bg-slate-50");
      }

      renderExams(examsForUser, filter);
    });
  });

  // ===== 11. Actions buttons (delegation) =====
  if (examsTableBodyEl) {
    examsTableBodyEl.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute("data-action");
      if (!action) return;

      const examId = target.getAttribute("data-examid");
      const exam = examsForUser.find(ex => String(ex.examId) === String(examId));
      if (!exam) return;

      if (action === "open-dashboard") {
        // בסימולציה פשוט נשלח לדשבורד הכללי
        alert(`Opening live dashboard for ${exam.courseCode} – ${exam.room} (simulation).`);
        window.location.href = "dashboard.html";
      } else if (action === "view-details") {
        alert(`Exam details:\n${exam.courseCode} – ${exam.courseName}\nDate: ${exam.date} ${exam.startTime}–${exam.endTime}\nRoom: ${exam.room}`);
      } else if (action === "view-summary") {
        alert(`Past exam summary (fake):\n${exam.courseCode} – ${exam.courseName}\nRoom: ${exam.room}`);
      } else if (action === "export") {
        alert(`Fake export of exam ${exam.courseCode} (${exam.date}) to PDF/Excel.`);
      }
    });
  }
});
