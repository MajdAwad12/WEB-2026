// fakeData.js
// Fake data for Exam Monitoring App (sidebar layout, dashboard, exams, attendance)

// ====== GENERAL DATE REFERENCE ======
const TODAY = "01-12-2025"; // you can change this freely


// ====== USERS (Admin + 3 Supervisors + 1 Lecturer) ======
const fakeAccounts = [
  {
    username: "Admin",
    password: "123",
    fullname: "System Administrator",
    role: "admin"
  },
  {
    username: "superAli",
    password: "123",
    fullname: "Ali Turner",
    role: "supervisor"
  },
  {
    username: "superMia",
    password: "1234",
    fullname: "Mia Roberts",
    role: "supervisor"
  },
  {
    username: "superJohn",
    password: "1234",
    fullname: "John Miller",
    role: "supervisor"
  },
  {
    username: "lectNaomi",
    password: "123",
    fullname: "Naomi Cohen",
    role: "lecturer"
  },
  {
    username: "studentDana",
    password: "1234",
    fullname: "Dana Levi",
    role: "student",
    studentId: "S005"   
  }

];

// ====== STUDENTS (30 students, English names) ======
const students = [
  { studentId: "S001", fullName: "Adam Walker",    email: "adam.walker@example.com" },
  { studentId: "S002", fullName: "Bella Green",    email: "bella.green@example.com" },
  { studentId: "S003", fullName: "Chris Taylor",   email: "chris.taylor@example.com" },
  { studentId: "S004", fullName: "Diana Lewis",    email: "diana.lewis@example.com" },
  { studentId: "S005", fullName: "Ethan Young",    email: "ethan.young@example.com" },
  { studentId: "S006", fullName: "Fiona Brown",    email: "fiona.brown@example.com" },
  { studentId: "S007", fullName: "George Harris",  email: "george.harris@example.com" },
  { studentId: "S008", fullName: "Hannah Clark",   email: "hannah.clark@example.com" },
  { studentId: "S009", fullName: "Ian Scott",      email: "ian.scott@example.com" },
  { studentId: "S010", fullName: "Julia Adams",    email: "julia.adams@example.com" },
  { studentId: "S011", fullName: "Kevin White",    email: "kevin.white@example.com" },
  { studentId: "S012", fullName: "Laura King",     email: "laura.king@example.com" },
  { studentId: "S013", fullName: "Michael Hall",   email: "michael.hall@example.com" },
  { studentId: "S014", fullName: "Nora Hill",      email: "nora.hill@example.com" },
  { studentId: "S015", fullName: "Oscar Moore",    email: "oscar.moore@example.com" },
  { studentId: "S016", fullName: "Paula Perez",    email: "paula.perez@example.com" },
  { studentId: "S017", fullName: "Ryan Ward",      email: "ryan.ward@example.com" },
  { studentId: "S018", fullName: "Sara Cook",      email: "sara.cook@example.com" },
  { studentId: "S019", fullName: "Thomas Gray",    email: "thomas.gray@example.com" },
  { studentId: "S020", fullName: "Uma Foster",     email: "uma.foster@example.com" },
  { studentId: "S021", fullName: "Victor Price",   email: "victor.price@example.com" },
  { studentId: "S022", fullName: "Wendy Barnes",   email: "wendy.barnes@example.com" },
  { studentId: "S023", fullName: "Xavier Stone",   email: "xavier.stone@example.com" },
  { studentId: "S024", fullName: "Yara Brooks",    email: "yara.brooks@example.com" },
  { studentId: "S025", fullName: "Zack Reed",      email: "zack.reed@example.com" },
  { studentId: "S026", fullName: "Emily Carter",   email: "emily.carter@example.com" },
  { studentId: "S027", fullName: "Noah Evans",     email: "noah.evans@example.com" },
  { studentId: "S028", fullName: "Olivia Cooper",  email: "olivia.cooper@example.com" },
  { studentId: "S029", fullName: "Liam Hughes",    email: "liam.hughes@example.com" },
  { studentId: "S030", fullName: "Grace Morgan",   email: "grace.morgan@example.com" }
];

// Helper: get all student ids for the current exam
const allStudentIds = students.map(s => s.studentId);

// ====== EXAMS DATA ======
// Multiple classrooms for the SAME exam (for lecturer view)
// + future exams

const exams = [
  // ----- Current shared exam – Room 101 -----
  {
    examId: 1,
    courseCode: "CS101",
    courseName: "Introduction to Programming",
    date: TODAY,
    startTime: "09:00",
    endTime: "12:00",
    building: "Main Building",
    room: "Room 101",
    lecturerUsername: "lectNaomi",
    supervisors: ["superAli"],
    status: "active"
  },

  // ----- SAME exam, other rooms (for lecturer tabs) -----
  {
    examId: 12,
    courseCode: "CS101",
    courseName: "Introduction to Programming",
    date: TODAY,
    startTime: "09:00",
    endTime: "12:00",
    building: "Main Building",
    room: "Room 102",
    lecturerUsername: "lectNaomi",
    supervisors: ["superMia"],
    status: "active"
  },
  {
    examId: 13,
    courseCode: "CS101",
    courseName: "Introduction to Programming",
    date: TODAY,
    startTime: "09:00",
    endTime: "12:00",
    building: "Main Building",
    room: "Room 103",
    lecturerUsername: "lectNaomi",
    supervisors: ["superJohn"],
    status: "active"
  },

  // ----- Upcoming exams for lecturer -----
  {
    examId: 2,
    courseCode: "CS201",
    courseName: "Data Structures",
    date: "2025-12-05",
    startTime: "14:00",
    endTime: "17:00",
    building: "Engineering",
    room: "Room 204",
    lecturerUsername: "lectNaomi",
    supervisors: ["superAli"],
    status: "upcoming"
  },
  {
    examId: 3,
    courseCode: "CS202",
    courseName: "Algorithms",
    date: "2025-12-12",
    startTime: "09:00",
    endTime: "12:00",
    building: "Engineering",
    room: "Room 305",
    lecturerUsername: "lectNaomi",
    supervisors: ["superAli"],
    status: "upcoming"
  },
  {
    examId: 4,
    courseCode: "CS250",
    courseName: "Database Systems",
    date: "2025-12-20",
    startTime: "13:00",
    endTime: "16:00",
    building: "Engineering",
    room: "Room 210",
    lecturerUsername: "lectNaomi",
    supervisors: ["superAli"],
    status: "upcoming"
  },

  // Mia future exams
  {
    examId: 5,
    courseCode: "CS310",
    courseName: "Operating Systems",
    date: "2026-01-03",
    startTime: "10:00",
    endTime: "13:00",
    building: "Main Building",
    room: "Room 120",
    lecturerUsername: "lectNaomi",
    supervisors: ["superMia"],
    status: "upcoming"
  },
  {
    examId: 6,
    courseCode: "CS320",
    courseName: "Computer Networks",
    date: "2026-01-10",
    startTime: "09:00",
    endTime: "12:00",
    building: "Main Building",
    room: "Room 130",
    lecturerUsername: "lectNaomi",
    supervisors: ["superMia"],
    status: "upcoming"
  },
  {
    examId: 7,
    courseCode: "CS330",
    courseName: "Software Engineering",
    date: "2026-01-17",
    startTime: "14:00",
    endTime: "17:00",
    building: "Engineering",
    room: "Room 220",
    lecturerUsername: "lectNaomi",
    supervisors: ["superMia"],
    status: "upcoming"
  },

  // John future exams
  {
    examId: 8,
    courseCode: "CS340",
    courseName: "Artificial Intelligence",
    date: "2026-01-24",
    startTime: "09:00",
    endTime: "12:00",
    building: "Science",
    room: "Room 310",
    lecturerUsername: "lectNaomi",
    supervisors: ["superJohn"],
    status: "upcoming"
  },
  {
    examId: 9,
    courseCode: "CS350",
    courseName: "Machine Learning",
    date: "2026-01-31",
    startTime: "13:00",
    endTime: "16:00",
    building: "Science",
    room: "Room 315",
    lecturerUsername: "lectNaomi",
    supervisors: ["superJohn"],
    status: "upcoming"
  },
  {
    examId: 10,
    courseCode: "CS360",
    courseName: "Web Development",
    date: "2026-02-07",
    startTime: "10:00",
    endTime: "13:00",
    building: "Innovation Center",
    room: "Room 402",
    lecturerUsername: "lectNaomi",
    supervisors: ["superJohn"],
    status: "upcoming"
  },

  // Extra future exam
  {
    examId: 11,
    courseCode: "CS370",
    courseName: "Cloud Computing",
    date: "2026-02-14",
    startTime: "09:00",
    endTime: "12:00",
    building: "Innovation Center",
    room: "Room 410",
    lecturerUsername: "lectNaomi",
    supervisors: [],
    status: "upcoming"
  }
];

// ===== Chatbot simulations for each main screen =====
const chatbotSimulations = {
  // מסך בית – משגיח
  home_supervisor: {
    role: "supervisor",
    screen: "home"
  },

  // דשבורד – משגיח, מצב מבחן בזמן אמת
  dashboard_supervisor: {
    role: "supervisor",
    screen: "dashboard",
    examName: "Data Structures",
    room: "Room 101",
    startTime: "09:00",
    endTime: "12:00",
    // נניח שנשארו 30 דקות לבחינה
    remainingMinutes: 30,
    stats: {
      present: 28,
      out: 1,
      absent: 2,
      late: 1,
      exceptions: 1
    }
  },

  // דשבורד – מרצה, רואה כמה כיתות / מבחנים
  dashboard_lecturer: {
    role: "lecturer",
    screen: "dashboard",
    examName: "Algorithms 1",
    startTime: "10:00",
    endTime: "13:00",
    remainingMinutes: 75,
    stats: {
      present: 60,
      out: 3,
      absent: 5,
      late: 4,
      exceptions: 3
    }
  },

  // נוכחות – משגיח בכיתה אחת, כולל יציאה לשירותים ארוכה
  attendance_supervisor: {
    role: "supervisor",
    screen: "attendance",
    examName: "Intro to CS",
    room: "Room 203",
    startTime: "09:00",
    endTime: "12:00",
    remainingMinutes: 45,
    stats: {
      present: 32,
      out: 2,
      absent: 1,
      late: 2,
      exceptions: 1
    },
    // רשימת יציאות – לשירותים, עם דקות בחוץ
    exits: [
      { studentId: "305612345", minutesOut: 18 },
      { studentId: "308998765", minutesOut: 5 }
    ]
  },

  // ניהול בחינות – מרצה, תכנון
  exams_lecturer: {
    role: "lecturer",
    screen: "exams",
    examName: "Operating Systems"
  },

  // דוחות – מרצה, סיכום 10 מבחנים
  reports_lecturer: {
    role: "lecturer",
    screen: "reports",
    stats: {
      present: 290,
      out: 15,
      absent: 20,
      late: 12,
      exceptions: 8
    }
  }
};

// ====== STUDENT EXAM SUMMARIES (for student view after exam) ======
const studentExamSummaries = [
  {
    studentId: "S005",           // מתאים ל-Dana Levi
    examId: 1,                   // מזהה בחינה קיימת
    courseName: "Introduction to Programming",
    date: TODAY,
    room: "Room 101",
    arrivalTime: "09:02",
    finishTime: "11:55",
    status: "Completed",
    extraTimeMinutes: 15,
    incidents: [
      "Late arrival: 2 minutes",
      "Temporary exit to restroom at 10:20 (7 minutes)"
    ]
  }
  // אפשר להוסיף עוד אובייקטים לסטודנטים / בחינות אחרות
];

// ====== EXAM REGISTRATIONS ======
const examRegistrations = {
  1: allStudentIds,              // Room 101
  12: allStudentIds.slice(0,20), // Room 102
  13: allStudentIds.slice(10,30),// Room 103

  2: allStudentIds.slice(0, 20),
  3: allStudentIds.slice(5, 25),
  4: allStudentIds.slice(10, 30),
  5: allStudentIds.slice(0, 15),
  6: allStudentIds.slice(5, 20),
  7: allStudentIds.slice(10, 25),
  8: allStudentIds.slice(0, 18),
  9: allStudentIds.slice(7, 27),
  10: allStudentIds.slice(3, 23),
  11: allStudentIds.slice(0, 10)
};




// ====== CURRENT EXAM STATUS (for Dashboard screen) ======
const currentExamId = 1;

const currentExamStatus = {
  examId: currentExamId,
  totalStudents: examRegistrations[currentExamId].length,
  presentCount: 26,
  tempOutCount: 2,
  absentCount: 2,
  startedAt: "09:00",
  plannedEnd: "12:00",
  remainingMinutes: 75, // fake / simulated value
  incidents: [
    {
      time: "09:40",
      type: "Bathroom break",
      studentId: "S004",
      severity: "medium",
      details: "Student went out for bathroom break."
    },
    {
      time: "10:15",
      type: "Late arrival",
      studentId: "S019",
      severity: "low",
      details: "Student arrived 15 minutes late."
    },
    {
      time: "10:42",
      type: "RuleViolation",
      studentId: "S007",
      severity: "high",
      action: "ExamCancelled",
      details: "Student caught using phone – exam cancelled by supervisor."
    }
  ]
};

// ===== ROOMS (כיתות בחינה) =====
const roomsData = [
  { id: "R101", name: "Room 101", capacity: 35, building: "Main", floor: 1 },
  { id: "R102", name: "Room 102", capacity: 30, building: "Main", floor: 1 },
  { id: "R203", name: "Room 203", capacity: 40, building: "North", floor: 2 }
];

// ===== EXAM–ROOM ASSIGNMENTS (שיבוץ כיתות ומשגיחים) =====
// שים לב: השמות/יוזרים צריכים להתאים למה שיש לך ב-fakeAccounts
const examRoomAssignments = [
  {
    examId: 1,
    course: "Data Structures",
    date: "2025-12-01",
    time: "09:00–12:00",
    roomId: "R101",
    roomName: "Room 101",
    lecturerUsername: "Aya",
    lecturerName: "Aya Kharma",
    supervisorUsername: "Ali",
    supervisorName: "Ali Hijazi",
    totalStudents: 30,
    extendedTimeStudents: 2
  },
  {
    examId: 1,
    course: "Data Structures",
    date: "2025-12-01",
    time: "09:00–12:00",
    roomId: "R102",
    roomName: "Room 102",
    lecturerUsername: "Aya",
    lecturerName: "Aya Kharma",
    supervisorUsername: "superAli",
    supervisorName: "Ali Turner",
    totalStudents: 25,
    extendedTimeStudents: 1
  },
  {
    examId: 2,
    course: "Intro to CS",
    date: "2025-12-02",
    time: "10:00–13:00",
    roomId: "R203",
    roomName: "Room 203",
    lecturerUsername: "Aya",
    lecturerName: "Aya Kharma",
    supervisorUsername: "Ali",
    supervisorName: "Ali Hijazi",
    totalStudents: 32,
    extendedTimeStudents: 3
  }
];

// ===== CLASSROOMS DATA for rooms.html (Classrooms Map) =====
// This structure is used by classroomMap.js / rooms.js

const classroomsData = [
  {
    roomId: "R101",
    building: "Main",          // יתאים ל־BUILDINGS ב-rooms.js
    capacity: 35,
    supervisor: "Ali Turner",  // superAli
    hasExam: true,
    exam: {
      name: "Introduction to Programming – Group 1",
      courseCode: "CS101",
      lecturer: "Naomi Cohen",
      timeFrom: "09:00",
      timeTo: "12:00"
    },
    // כאן אתה יכול לכתוב שמות חופשיים, או לשלב id+name
    students: [
      "S001 – Adam Walker",
      "S002 – Bella Green",
      "S003 – Chris Taylor",
      "S004 – Diana Lewis",
      "S005 – Ethan Young",
      "S006 – Fiona Brown",
      "S007 – George Harris",
      "S008 – Hannah Clark",
      "S009 – Ian Scott",
      "S010 – Julia Adams"
    ]
  },
  {
    roomId: "R102",
    building: "Main",
    capacity: 30,
    supervisor: "Mia Roberts",
    hasExam: true,
    exam: {
      name: "Introduction to Programming – Group 2",
      courseCode: "CS101",
      lecturer: "Naomi Cohen",
      timeFrom: "09:00",
      timeTo: "12:00"
    },
    students: [
      "S011 – Kevin White",
      "S012 – Laura King",
      "S013 – Michael Hall",
      "S014 – Nora Hill",
      "S015 – Oscar Moore",
      "S016 – Paula Perez",
      "S017 – Ryan Ward",
      "S018 – Sara Cook",
      "S019 – Thomas Gray",
      "S020 – Uma Foster"
    ]
  },
  {
    roomId: "R203",
    building: "North",
    capacity: 40,
    supervisor: "John Miller",
    hasExam: false,      // כרגע בלי מבחן פעיל – רק כיתה קיימת
    exam: null,
    students: []         // אין סטודנטים כי אין מבחן
  }
];

// ====== Runtime incidents (from attendance.js simulation) ======
// attendance.js ידחוף לכאן Rule Violations שנעשו בזמן הסימולציה
window.runtimeIncidents = window.runtimeIncidents || [];
