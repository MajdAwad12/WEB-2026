// rooms.js
// Classrooms Map screen – using fakeData.js
// - Supervisor: sees only his room(s) with detailed seat map
// - Lecturer: sees all rooms where his exam runs (from exams[])
// - Admin: sees ALL rooms (from exams + roomsData)
// Role comes from localStorage: "examApp_currentUser"

function formatRole(role) {
  if (!role) return "-";
  if (role === "supervisor") return "Supervisor";
  if (role === "lecturer") return "Lecturer";
  if (role === "admin") return "System Admin";
  return role;
}

function seatColorClasses(status) {
  switch (status) {
    case "present":
      return "bg-emerald-500 text-white";
    case "late":
    case "out":
      return "bg-amber-400 text-white";
    case "absent":
      return "bg-rose-500 text-white";
    case "suspect":
      return "bg-purple-500 text-white";
    case "empty":
    default:
      return "bg-slate-300 text-slate-700";
  }
}

function findStudentById(id) {
  if (typeof students === "undefined") return null;
  return students.find((s) => s.studentId === id) || null;
}

function findUserByUsername(username) {
  if (typeof fakeAccounts === "undefined") return null;
  return fakeAccounts.find((u) => u.username === username) || null;
}

// ===== Build "classrooms" array from fakeData.js =====
function buildClassroomsForUser(user) {
  const assignments =
    typeof examRoomAssignments !== "undefined" ? examRoomAssignments : [];
  const rooms = typeof roomsData !== "undefined" ? roomsData : [];
  const regs =
    typeof examRegistrations !== "undefined" ? examRegistrations : {};
  const examsArr = typeof exams !== "undefined" ? exams : [];

  const result = [];

  const isSupervisor = user.role === "supervisor";
  const isLecturer = user.role === "lecturer";
  const isAdmin = user.role === "admin";

  function addClassroom(c) {
    const exists = result.some(
      (x) => x.examId === c.examId && x.roomId === c.roomId
    );
    if (!exists) {
      result.push(c);
    }
  }

  // 1) From examRoomAssignments (אם קיימים)
  assignments.forEach((a) => {
    if (isSupervisor) {
      if (
        a.supervisorUsername !== user.username &&
        a.supervisorName !== user.fullname
      ) {
        return;
      }
    } else if (isLecturer) {
      if (
        a.lecturerUsername !== user.username &&
        a.lecturerName !== user.fullname
      ) {
        return;
      }
    }

    const roomInfo = rooms.find((r) => r.id === a.roomId) || null;
    const examObj = examsArr.find((ex) => ex.examId === a.examId) || null;
    const examRegIds = regs[a.examId] || [];

    const capacity =
      (roomInfo && roomInfo.capacity) ||
      a.totalStudents ||
      examRegIds.length ||
      30;

    const studentsDisplay = examRegIds.map((sid) => {
      const st = findStudentById(sid);
      if (!st) return sid;
      return `${st.fullName} (${st.studentId})`;
    });

    addClassroom({
      examId: a.examId,
      roomId: a.roomId,
      roomName: a.roomName || (roomInfo ? roomInfo.name : a.roomId),
      building: roomInfo ? roomInfo.building : "Main",
      floor: roomInfo ? roomInfo.floor : 1,
      capacity,
      hasExam: true,
      exam: {
        name: a.course || (examObj ? examObj.courseName : "Exam"),
        courseCode: examObj ? examObj.courseCode : "",
        date: a.date || (examObj ? examObj.date : ""),
        time:
          a.time ||
          (examObj ? `${examObj.startTime}–${examObj.endTime}` : "")
      },
      supervisorName: a.supervisorName || "-",
      supervisorUsername: a.supervisorUsername || null,
      lecturerName: a.lecturerName || "-",
      lecturerUsername: a.lecturerUsername || null,
      studentIds: examRegIds,
      studentsDisplay
    });
  });

  // 2) From exams[] (active) – לפי role
  examsArr.forEach((ex) => {
    if (isSupervisor) {
      const supList = Array.isArray(ex.supervisors) ? ex.supervisors : [];
      if (!supList.includes(user.username)) return;
      if (ex.status !== "active") return;
    }

    if (isLecturer) {
      if (ex.lecturerUsername !== user.username) return;
      if (ex.status !== "active") return;
    }

    if (isAdmin && ex.status !== "active") return;

    const examRegIds = regs[ex.examId] || [];
    const capacityGuess = examRegIds.length || 30;

    const studentsDisplay = examRegIds.map((sid) => {
      const st = findStudentById(sid);
      if (!st) return sid;
      return `${st.fullName} (${st.studentId})`;
    });

    const supList = Array.isArray(ex.supervisors) ? ex.supervisors : [];
    const mainSupUsername = supList.length > 0 ? supList[0] : null;
    let supName = "-";
    if (mainSupUsername) {
      const su = findUserByUsername(mainSupUsername);
      if (su) supName = su.fullname;
    }

    let lecturerName = "-";
    if (isLecturer) {
      lecturerName = user.fullname;
    } else {
      const lu = findUserByUsername(ex.lecturerUsername);
      if (lu) lecturerName = lu.fullname;
    }

    addClassroom({
      examId: ex.examId,
      roomId: ex.room,
      roomName: ex.room,
      building: ex.building || "Main Building",
      floor: 1,
      capacity: capacityGuess,
      hasExam: true,
      exam: {
        name: ex.courseName,
        courseCode: ex.courseCode,
        date: ex.date,
        time: `${ex.startTime}–${ex.endTime}`
      },
      supervisorName: supName,
      supervisorUsername: mainSupUsername,
      lecturerName,
      lecturerUsername: ex.lecturerUsername,
      studentIds: examRegIds,
      studentsDisplay
    });
  });

  // 3) Admin – כיתות ללא בחינה מתוך roomsData
  if (isAdmin && rooms.length > 0) {
    rooms.forEach((r) => {
      const already = result.some((c) => c.roomId === r.id);
      if (!already) {
        addClassroom({
          examId: null,
          roomId: r.id,
          roomName: r.name,
          building: r.building,
          floor: r.floor,
          capacity: r.capacity,
          hasExam: false,
          exam: null,
          supervisorName: "-",
          supervisorUsername: null,
          lecturerName: "-",
          lecturerUsername: null,
          studentIds: [],
          studentsDisplay: []
        });
      }
    });
  }

  return result;
}

// ===== Main =====
document.addEventListener("DOMContentLoaded", () => {
  // ---- current user from login ----
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("examApp_currentUser"));
  } catch (e) {
    user = null;
  }

  if (!user) {
    user = {
      username: "superAli",
      fullname: "Ali Turner",
      role: "supervisor"
    };
  }

  // ---- DOM elements ----
  const fullNameEl = document.getElementById("userFullName");
  const roleEl = document.getElementById("userRole");
  const currentDateEl = document.getElementById("currentDate");
  const headerSubtitleEl = document.getElementById("headerSubtitle");
  const roleInfoTextEl = document.getElementById("roleInfoText");
  const btnLogout = document.getElementById("btnLogout");

  const roomsGrid = document.getElementById("roomsGrid");
  const searchInput = document.getElementById("searchInput");
  const examRoomsCount = document.getElementById("examRoomsCount");
  const showOnlyExamsBtn = document.getElementById("showOnlyExamsBtn");
  const generateReportBtn = document.getElementById("generateReport");

  const roomModal = document.getElementById("roomModal");
  const closeModal = document.getElementById("closeModal");
  const modalRoomTitle = document.getElementById("modalRoomTitle");
  const modalRoomSubtitle = document.getElementById("modalRoomSubtitle");
  const seatGrid = document.getElementById("seatGrid");
  const seatList = document.getElementById("seatList");

  // NEW: controls inside modal for managing students
  const moveStudentIdSelect = document.getElementById("moveStudentIdSelect");
  const moveTargetRoomSelect = document.getElementById("moveTargetRoomSelect");
  const btnMoveStudent = document.getElementById("btnMoveStudent");
  const addStudentIdInput = document.getElementById("addStudentIdInput");
  const addStudentNameInput = document.getElementById("addStudentNameInput");
  const btnAddStudent = document.getElementById("btnAddStudent");

  // ---- Header / user info ----
  if (fullNameEl) fullNameEl.textContent = user.fullname || user.username;
  if (roleEl) roleEl.textContent = formatRole(user.role).toUpperCase();

  if (currentDateEl) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    currentDateEl.textContent = `Today: ${dateStr}`;
  }

  if (headerSubtitleEl) {
    if (user.role === "supervisor") {
      headerSubtitleEl.textContent =
        "You see the classroom map for your assigned exam room, including each seat and student (simulation).";
    } else if (user.role === "lecturer") {
      headerSubtitleEl.textContent =
        "You see all rooms where your exam is running, with supervisors and risk indicators (simulation).";
    } else {
      headerSubtitleEl.textContent =
        "Admin view – overview of all rooms and exams (simulation).";
    }
  }

  if (roleInfoTextEl) {
    if (user.role === "supervisor") {
      roleInfoTextEl.textContent =
        "As a supervisor you see only your classroom, with a detailed seat map and students for the current exam.";
    } else if (user.role === "lecturer") {
      roleInfoTextEl.textContent =
        "As a lecturer you can see all rooms where your exam runs, and open each room to see a detailed classroom layout.";
    } else {
      roleInfoTextEl.textContent =
        "Admin can monitor all rooms and simulate different exam assignments across the campus.";
    }
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("examApp_currentUser");
      window.location.href = "login.html";
    });
  }

  // ---- Build logical classrooms ----
  let classrooms = buildClassroomsForUser(user);
  let showOnlyExams = false;
  let currentModalRoomId = null; // NEW: track which room is open in modal

  // Helper: populate management controls (move/add) for current room
  function populateRoomManagementControls(currentRoom) {
    if (!currentRoom) return;

    // Students in this room
    if (moveStudentIdSelect) {
      moveStudentIdSelect.innerHTML =
        '<option value="">-- Select student --</option>';

      (currentRoom.studentIds || []).forEach((sid) => {
        const st = findStudentById(sid);
        const label = st ? `${st.fullName} (${st.studentId})` : sid;
        const opt = document.createElement("option");
        opt.value = sid;
        opt.textContent = label;
        moveStudentIdSelect.appendChild(opt);
      });
    }

    // Target rooms (all other rooms)
    if (moveTargetRoomSelect) {
      moveTargetRoomSelect.innerHTML =
        '<option value="">-- Select room --</option>';

      classrooms
        .filter((r) => r.roomId !== currentRoom.roomId)
        .forEach((r) => {
          const opt = document.createElement("option");
          opt.value = r.roomId;
          opt.textContent = `${r.roomName} (${r.building})`;
          moveTargetRoomSelect.appendChild(opt);
        });
    }

    // Clear add-student inputs
    if (addStudentIdInput) addStudentIdInput.value = "";
    if (addStudentNameInput) addStudentNameInput.value = "";
  }

  // ---- Render rooms ----
  function renderRooms() {
    if (!roomsGrid) return;
    roomsGrid.innerHTML = "";

    const query = (searchInput?.value || "").toLowerCase().trim();

    const total = classrooms.length;
    const examCount = classrooms.filter((c) => c.hasExam).length;

    const filtered = classrooms.filter((room) => {
      if (showOnlyExams && !room.hasExam) return false;

      if (!query) return true;

      const supervisorMatch =
        (room.supervisorName || "").toLowerCase().includes(query);
      const roomMatch =
        (room.roomName || "").toLowerCase().includes(query) ||
        (room.roomId || "").toLowerCase().includes(query);
      const examMatch =
        (room.exam?.name || "").toLowerCase().includes(query) ||
        (room.exam?.courseCode || "").toLowerCase().includes(query);
      const studentMatch = (room.studentsDisplay || []).some((s) =>
        s.toLowerCase().includes(query)
      );

      return supervisorMatch || roomMatch || examMatch || studentMatch;
    });

    if (examRoomsCount) {
      examRoomsCount.textContent = `Exam Rooms: ${examCount} / ${total}`;
    }

    if (filtered.length === 0) {
      roomsGrid.innerHTML = `
        <div class="col-span-full bg-white/90 rounded-2xl p-6 text-center text-slate-600 shadow">
          No rooms match your search or filter (simulation).
        </div>
      `;
      return;
    }

    const buildings = {};
    filtered.forEach((room) => {
      const b = room.building || "Main";
      if (!buildings[b]) buildings[b] = [];
      buildings[b].push(room);
    });

    Object.keys(buildings).forEach((building) => {
      const buildingRooms = buildings[building];

      roomsGrid.innerHTML += `
        <div class="col-span-full mb-1 mt-4">
          <h3 class="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-600 text-white font-bold shadow">
              ${building[0].toUpperCase()}
            </span>
            Building ${building}
          </h3>
          <p class="text-xs text-slate-500">
            Rooms in Building ${building} – click a room to view the classroom layout and seats.
          </p>
        </div>
      `;

      buildingRooms.forEach((room) => {
        const highlight = room.hasExam
          ? "bg-sky-50 border-sky-300 shadow-xl"
          : "bg-white border-slate-200";

        const examDetails = room.hasExam
          ? `
              <p class="text-xs text-slate-600 mt-1"><b>Course:</b> ${room.exam.name}</p>
              <p class="text-xs text-slate-600"><b>Date:</b> ${room.exam.date}</p>
              <p class="text-xs text-slate-600"><b>Time:</b> ${room.exam.time}</p>
            `
          : `
              <p class="text-xs text-slate-500 mt-1">No active exam in this room (simulation).</p>
            `;

        const progressPercent =
          room.capacity > 0
            ? Math.min(
                100,
                Math.round((room.studentIds.length / room.capacity) * 100)
              )
            : 0;

        roomsGrid.innerHTML += `
          <div
            class="${highlight} cursor-pointer rounded-2xl p-5 border transition hover:scale-[1.02] hover:shadow-2xl"
            data-room-id="${room.roomId}"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-lg font-bold text-slate-900">
                ${room.roomName}
              </h4>
              ${
                room.hasExam
                  ? `<span class="px-2 py-1 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                       Active exam
                     </span>`
                  : `<span class="px-2 py-1 rounded-full text-[11px] bg-slate-50 text-slate-600 border border-slate-200">
                       No exam
                     </span>`
              }
            </div>

            ${examDetails}

            <p class="text-xs text-slate-600 mt-1">
              <b>Supervisor:</b> ${room.supervisorName || "-"}
            </p>

            <p class="text-xs text-slate-600 mt-1">
              <b>Students:</b> ${room.studentIds.length} / ${room.capacity}
            </p>

            <div class="mt-3 w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-2.5 bg-sky-500 rounded-full" style="width:${progressPercent}%"></div>
            </div>
          </div>
        `;
      });
    });

    const cards = roomsGrid.querySelectorAll("[data-room-id]");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const roomId = card.getAttribute("data-room-id");
        openRoomModal(roomId);
      });
    });
  }

  function openRoomModal(roomId) {
    if (!roomModal || !seatGrid || !seatList) return;

    const room = classrooms.find((r) => r.roomId === roomId);
    if (!room) return;

    currentModalRoomId = roomId; // track current room for move/add

    const studentIds = room.studentIds || [];

    if (modalRoomTitle) {
      modalRoomTitle.textContent = `${room.roomName} – ${
        room.exam ? room.exam.name : "No exam"
      }`;
    }
    if (modalRoomSubtitle) {
      modalRoomSubtitle.textContent = `Building: ${room.building} · Floor: ${
        room.floor
      } · Supervisor: ${
        room.supervisorName || "-"
      }${room.exam ? ` · Time: ${room.exam.time}` : ""}`;
    }

    const statusByStudent = {};
    studentIds.forEach((sid) => (statusByStudent[sid] = "present"));

    const incidents =
      typeof currentExamStatus !== "undefined" && currentExamStatus.incidents
        ? currentExamStatus.incidents
        : [];

    incidents.forEach((inc) => {
      const sid = inc.studentId;
      if (!sid || !statusByStudent[sid]) return;

      if (inc.type === "Bathroom break") {
        statusByStudent[sid] = "out";
      } else if (inc.type === "Late arrival") {
        statusByStudent[sid] = "late";
      } else if (inc.type === "RuleViolation") {
        statusByStudent[sid] = "suspect";
      }
    });

    let absentToSet =
      typeof currentExamStatus !== "undefined"
        ? currentExamStatus.absentCount || 0
        : 0;

    if (absentToSet > 0) {
      for (let i = studentIds.length - 1; i >= 0 && absentToSet > 0; i--) {
        const sid = studentIds[i];
        if (
          statusByStudent[sid] === "present" ||
          statusByStudent[sid] === "late"
        ) {
          statusByStudent[sid] = "absent";
          absentToSet--;
        }
      }
    }

    const rows = 4;
    const cols = 8;
    const totalSeats = rows * cols;

    seatGrid.innerHTML = "";
    seatList.innerHTML = "";

    for (let seatIndex = 0; seatIndex < totalSeats; seatIndex++) {
      const seatNumber = seatIndex + 1;
      const sid = studentIds[seatIndex] || null;
      const student = sid ? findStudentById(sid) : null;

      let status = "empty";
      if (sid && statusByStudent[sid]) {
        status = statusByStudent[sid];
      }

      const wrapper = document.createElement("div");
      wrapper.className = "flex flex-col items-center gap-1";

      const seatDiv = document.createElement("div");
      seatDiv.className =
        "w-9 h-9 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm " +
        seatColorClasses(status);
      seatDiv.textContent = seatNumber;

      const label = document.createElement("p");
      label.className =
        "text-[9px] text-slate-700 text-center w-16 truncate";

      let labelText = "Empty seat";
      if (student) {
        const shortName = student.fullName.split(" ")[0];
        labelText = `${shortName} (${student.studentId})`;
      } else if (sid) {
        // NEW: אם הסטודנט לא קיים ב-students אבל יש sid
        labelText = sid;
      }

      label.textContent = labelText;
      label.title =
        labelText + (status !== "empty" ? ` – status: ${status}` : "");

      wrapper.appendChild(seatDiv);
      wrapper.appendChild(label);
      seatGrid.appendChild(wrapper);

      const li = document.createElement("li");
      li.className = "text-xs text-slate-700";

      let fullStudentText = "Empty";
      if (student) {
        fullStudentText = `${student.fullName} (${student.studentId})`;
      } else if (sid) {
        fullStudentText = sid;
      }

      li.textContent = `Seat ${seatNumber}: ${fullStudentText}${
        status !== "empty" ? ` – status: ${status}` : ""
      }`;
      seatList.appendChild(li);
    }

    // NEW: fill the move/add controls
    populateRoomManagementControls(room);

    roomModal.classList.remove("hidden");
    roomModal.classList.add("flex");
  }

  if (closeModal && roomModal) {
    closeModal.addEventListener("click", () => {
      roomModal.classList.add("hidden");
      roomModal.classList.remove("flex");
      currentModalRoomId = null;
    });

    roomModal.addEventListener("click", (e) => {
      if (e.target === roomModal) {
        roomModal.classList.add("hidden");
        roomModal.classList.remove("flex");
        currentModalRoomId = null;
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderRooms);
  }

  if (showOnlyExamsBtn) {
    showOnlyExamsBtn.addEventListener("click", () => {
      showOnlyExams = !showOnlyExams;

      if (showOnlyExams) {
        showOnlyExamsBtn.classList.remove("bg-white", "text-sky-700");
        showOnlyExamsBtn.classList.add("bg-sky-600", "text-white");
      } else {
        showOnlyExamsBtn.classList.remove("bg-sky-600", "text-white");
        showOnlyExamsBtn.classList.add("bg-white", "text-sky-700");
      }

      renderRooms();
    });
  }

  if (generateReportBtn) {
    generateReportBtn.addEventListener("click", () => {
      let out = "📋 Rooms Report (simulation)\n\n";
      classrooms.forEach((r) => {
        out += `Room: ${r.roomName} (${r.roomId}), Building ${r.building}\n`;
        out += `Has exam: ${r.hasExam ? "Yes" : "No"}\n`;
        if (r.hasExam) {
          out += `Course: ${r.exam.name}\n`;
          out += `Date & time: ${r.exam.date} ${r.exam.time}\n`;
        }
        out += `Supervisor: ${r.supervisorName || "-"}\n`;
        out += `Students: ${
          (r.studentsDisplay && r.studentsDisplay.length > 0)
            ? r.studentsDisplay.join(", ")
            : "None"
        }\n\n`;
      });
      alert(out);
    });
  }

  // NEW: move student between rooms (simulation)
  if (btnMoveStudent && moveStudentIdSelect && moveTargetRoomSelect) {
    btnMoveStudent.addEventListener("click", () => {
      const sid = moveStudentIdSelect.value;
      const targetRoomId = moveTargetRoomSelect.value;

      if (!sid || !targetRoomId || !currentModalRoomId) {
        alert("Please select a student and a target room (simulation).");
        return;
      }

      const fromRoom = classrooms.find(
        (r) => r.roomId === currentModalRoomId
      );
      const toRoom = classrooms.find((r) => r.roomId === targetRoomId);

      if (!fromRoom || !toRoom) {
        alert("Cannot find selected rooms (simulation).");
        return;
      }

      // Remove from current room
      fromRoom.studentIds = (fromRoom.studentIds || []).filter(
        (id) => id !== sid
      );
      fromRoom.studentsDisplay = (fromRoom.studentsDisplay || []).filter(
        (txt) => !txt.includes(sid)
      );

      // Add to target room
      if (!toRoom.studentIds) toRoom.studentIds = [];
      if (!toRoom.studentIds.includes(sid)) {
        toRoom.studentIds.push(sid);
      }

      if (!toRoom.studentsDisplay) toRoom.studentsDisplay = [];
      const st = findStudentById(sid);
      const label = st ? `${st.fullName} (${st.studentId})` : sid;
      if (!toRoom.studentsDisplay.some((txt) => txt.includes(sid))) {
        toRoom.studentsDisplay.push(label);
      }

      renderRooms();
      openRoomModal(currentModalRoomId);

      alert(
        `Student ${label} moved from ${fromRoom.roomName} to ${toRoom.roomName} (simulation).`
      );
    });
  }

  // NEW: add missing student to current room (simulation)
  if (btnAddStudent && addStudentIdInput && addStudentNameInput) {
    btnAddStudent.addEventListener("click", () => {
      const sid = addStudentIdInput.value.trim();
      const name = addStudentNameInput.value.trim();

      if (!sid || !name || !currentModalRoomId) {
        alert("Please enter student ID and full name (simulation).");
        return;
      }

      const room = classrooms.find((r) => r.roomId === currentModalRoomId);
      if (!room) {
        alert("Cannot find current room (simulation).");
        return;
      }

      if (!room.studentIds) room.studentIds = [];
      if (!room.studentsDisplay) room.studentsDisplay = [];

      if (!room.studentIds.includes(sid)) {
        room.studentIds.push(sid);
      }

      const label = `${name} (${sid})`;
      if (!room.studentsDisplay.some((txt) => txt.includes(sid))) {
        room.studentsDisplay.push(label);
      }

      addStudentIdInput.value = "";
      addStudentNameInput.value = "";

      renderRooms();
      openRoomModal(currentModalRoomId);

      alert(
        `Student ${label} added to room ${room.roomName} (simulation).`
      );
    });
  }

  renderRooms();

  if (typeof chatbotSimulations !== "undefined") {
    if (user.role === "supervisor") {
      window.EXAM_APP_CONTEXT =
        chatbotSimulations.attendance_supervisor ||
        chatbotSimulations.dashboard_supervisor;
    } else {
      window.EXAM_APP_CONTEXT =
        chatbotSimulations.reports_lecturer ||
        chatbotSimulations.dashboard_lecturer;
    }
  }
});
