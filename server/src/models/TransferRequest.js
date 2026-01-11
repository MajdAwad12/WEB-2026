// ===== file: server/src/models/TransferRequest.js =====
import mongoose from "mongoose";

const transferRequestSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },

    studentId: { type: String, required: true }, // keep consistent with your attendance lookups
    studentName: { type: String, default: "" },
    studentCode: { type: String, default: "" },

    fromClassroom: { type: String, required: true },
    fromSeat: { type: String, default: "" },

    toClassroom: { type: String, required: true },
    toSeat: { type: String, default: "AUTO" },

    prevStatus: { type: String, default: "" },
    prevClassroom: { type: String, default: "" },
    prevSeat: { type: String, default: "" },

    seat: { type: String, default: "" }, // legacy

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    requestedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
      roomId: { type: String, default: "" },
    },

    handledBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      roomId: { type: String, default: "" },
    },

    lastError: { type: String, default: "" }, // ROOM_FULL / SEAT_TAKEN / ...
    lastErrorAt: { type: Date, default: null },

    reasonCode: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

transferRequestSchema.index({ examId: 1, createdAt: -1 });
transferRequestSchema.index({ examId: 1, studentId: 1, status: 1 });

export default mongoose.model("TransferRequest", transferRequestSchema);
