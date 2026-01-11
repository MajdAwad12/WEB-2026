// server/src/models/Exam.js
import mongoose from "mongoose";

/* =========================
   Attendance (per student)
========================= */
const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    name: { type: String, default: "" },
    studentNumber: { type: String, default: "" },

    // ✅ IMPORTANT: keep BOTH fields (you use them in UI)
    classroom: { type: String, default: "" }, // e.g. "A101"
    roomId: { type: String, default: "" }, // ✅ used by autoAssign
    seat: { type: String, default: "" }, // e.g. "R1-C3"

    status: {
      type: String,
      enum: ["not_arrived", "present", "temp_out", "absent", "moving", "finished"],
      default: "not_arrived",
    },

    arrivedAt: { type: Date, default: null },
    outStartedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lastStatusAt: { type: Date, default: null },

    violations: { type: Number, default: 0 },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    type: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    description: { type: String, default: "" },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    classroom: { type: String, default: "" },
    seat: { type: String, default: "" },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const reportTimelineSchema = new mongoose.Schema(
  {
    kind: { type: String, default: "" },
    at: { type: Date, default: Date.now },

    roomId: { type: String, default: "" },

    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
    },

    student: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      code: { type: String, default: "" },
      seat: { type: String, default: "" },
      classroom: { type: String, default: "" },
    },

    details: { type: Object, default: {} },
  },
  { _id: false }
);

const studentStatSchema = new mongoose.Schema(
  {
    toiletCount: { type: Number, default: 0 },
    totalToiletMs: { type: Number, default: 0 },

    activeToilet: {
      leftAt: { type: Date, default: null },
      bySupervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "toilet" },
    },

    incidentCount: { type: Number, default: 0 },
    lastIncidentAt: { type: Date, default: null },
  },
  { _id: false }
);

const studentFileTimelineSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, default: "" },
    note: { type: String, default: "" },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    classroom: { type: String, default: "" },
    seat: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { _id: false }
);

const studentFileSchema = new mongoose.Schema(
  {
    arrivedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    toiletCount: { type: Number, default: 0 },
    totalToiletMs: { type: Number, default: 0 },
    activeToilet: {
      leftAt: { type: Date, default: null },
      bySupervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },

    incidentCount: { type: Number, default: 0 },
    violations: { type: Number, default: 0 },

    notes: { type: [String], default: [] },
    timeline: { type: [studentFileTimelineSchema], default: [] },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },

    from: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
    },

    toUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    toRoles: { type: [String], default: [] },

    roomId: { type: String, default: "" },
    text: { type: String, default: "" },

    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { _id: false }
);

const classroomSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    name: { type: String, default: "" },

    rows: { type: Number, default: 5 },
    cols: { type: Number, default: 5 },

    assignedSupervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedSupervisorName: { type: String, default: "" },
  },
  { _id: false }
);

/* =========================
   ✅ NEW: Lecturer assignment per rooms
   - 1 lecturer per 3 rooms
========================= */
const lecturerAssignmentSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "" },
    roomIds: { type: [String], default: [] }, // ✅ e.g. ["A101","B202","C303"]
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    courseName: { type: String, required: true },
    examMode: { type: String, enum: ["onsite", "online"], default: "onsite" },

    examDate: { type: Date, required: true },

    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },

    status: { type: String, enum: ["scheduled", "running", "ended"], default: "scheduled" },

    // ✅ Main lecturer (for first 3 rooms)
    lecturer: { type: lecturerAssignmentSchema, required: true },

    // ✅ Additional lecturers (each for next 3 rooms)
    coLecturers: { type: [lecturerAssignmentSchema], default: [] },

    supervisors: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, default: "" },
        roomId: { type: String, default: "" },
      },
    ],

    classrooms: { type: [classroomSchema], default: [] },

    attendance: { type: [attendanceSchema], default: [] },
    events: { type: [eventSchema], default: [] },
    messages: { type: [messageSchema], default: [] },

    note: { type: String, default: "" },

    report: {
      generatedAt: { type: Date, default: null },
      notes: { type: String, default: "" },

      summary: {
        totalStudents: { type: Number, default: 0 },
        present: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        temp_out: { type: Number, default: 0 },
        not_arrived: { type: Number, default: 0 },
        finished: { type: Number, default: 0 },
        violations: { type: Number, default: 0 },
        incidents: { type: Number, default: 0 },
        transfers: { type: Number, default: 0 },
      },

      timeline: { type: [reportTimelineSchema], default: [] },

      studentStats: { type: Map, of: studentStatSchema, default: {} },
      studentFiles: { type: Map, of: studentFileSchema, default: {} },
    },
  },
  {
    timestamps: true,
    collection: "moddle", // ✅ keep as you requested
  }
);

examSchema.index({ status: 1, startAt: 1 });
examSchema.index({ "lecturer.id": 1, status: 1 });
examSchema.index({ "supervisors.id": 1, status: 1 });

export default mongoose.model("Exam", examSchema);
