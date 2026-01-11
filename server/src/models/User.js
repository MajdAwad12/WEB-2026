// server/src/models/User.js
import mongoose from "mongoose";

/* =========================
   Student Exam File (per exam)
========================= */
const studentEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, default: "" }, // e.g. "toilet_exit", "cheating_suspected", "transfer"
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    roomId: { type: String, default: "" },
    seat: { type: String, default: "" },
    by: {
      name: { type: String, default: "" }, // supervisor / system
      role: { type: String, default: "" },
    },
    meta: { type: Object, default: {} },
  },
  { _id: false }
);

const studentTransferSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    fromRoomId: { type: String, default: "" },
    toRoomId: { type: String, default: "" },
    reason: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
  },
  { _id: false }
);

const studentExamFileSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },

    courseName: { type: String, default: "" },
    examDate: { type: Date, default: null },

    roomId: { type: String, default: "" },
    seat: { type: String, default: "" },

    lecturerName: { type: String, default: "" },
    supervisorName: { type: String, default: "" },

    status: { type: String, default: "" }, // present/finished/etc.

    arrivedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    toiletCount: { type: Number, default: 0 },
    totalToiletMs: { type: Number, default: 0 },

    violations: { type: Number, default: 0 },
    incidentCount: { type: Number, default: 0 },

    score: { type: Number, default: null },

    notes: { type: [String], default: [] },

    transfers: { type: [studentTransferSchema], default: [] },
    events: { type: [studentEventSchema], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    /* ---------- Basic Identity ---------- */
    fullName: { type: String, required: true, trim: true },

    username: { type: String, required: true, unique: true, lowercase: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    /* ---------- Auth ---------- */
    // ⚠️ Plain password – DEMO / COURSE ONLY
    password: { type: String, required: true },

    /* ---------- Role & Permissions ---------- */
    role: { type: String, required: true, enum: ["admin", "supervisor", "lecturer", "student"] },

    /* ---------- Student-only ---------- */
    studentId: { type: String, default: null, index: true },

    // ✅ NEW: student personal file across exams (read-only page)
    studentFiles: { type: [studentExamFileSchema], default: [] },

    /* ---------- Supervisor-only ---------- */
    assignedRoomId: { type: String, default: null },
  },
  { timestamps: true, collection: "users" }
);

export default mongoose.model("User", userSchema);
