// server/src/models/Classroom.js
import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, trim: true }, // e.g. A101
    name: { type: String, required: true, trim: true }, // e.g. A101 (display)
    building: { type: String, default: "", trim: true }, // e.g. "Building A"
    floor: { type: Number, default: 1 },
    locationNote: { type: String, default: "", trim: true }, // e.g. "Near lab 3"
    capacity: { type: Number, default: 25 }, // logical capacity
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "classrooms" }
);

export default mongoose.model("Classroom", classroomSchema);
