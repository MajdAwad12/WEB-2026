// server/src/routes/exams.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getExams,
  getExamById,
  createExam,          // ✅ NEW
  updateAttendance,
  startExam,
  endExam,
} from "../controllers/exams.controller.js";

const router = Router();

router.get("/", requireAuth, getExams);
router.get("/:examId", requireAuth, getExamById);

// ✅ CREATE EXAM (was missing => caused 404)
router.post("/", requireAuth, createExam);

router.patch("/:examId/attendance/:studentId", requireAuth, updateAttendance);

router.post("/:examId/start", requireAuth, startExam);
router.post("/:examId/end", requireAuth, endExam);

export default router;
