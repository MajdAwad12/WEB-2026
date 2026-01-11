// server/src/routes/admin.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listUsers,
  listExams,
  updateExamAdmin,
  deleteExamAdmin,
  autoAssignExam,
  autoAssignDraft, // ✅ NEW
} from "../controllers/admin.controller.js";

const router = Router();

// =========================
// Admin-only endpoints
// =========================
router.get("/users", requireAuth, listUsers);

// =========================
// Exams management (admin)
// =========================
router.get("/exams", requireAuth, listExams);
router.put("/exams/:examId", requireAuth, updateExamAdmin);
router.delete("/exams/:examId", requireAuth, deleteExamAdmin);

// =========================
// Auto-Assign
// =========================

// ✅ NEW: Draft Auto-Assign (Create Exam Modal only)
// - Does NOT save anything to DB
router.post("/exams/auto-assign-draft", requireAuth, autoAssignDraft);

// Existing: Auto-Assign for an existing exam (by examId)
router.post("/exams/:examId/auto-assign", requireAuth, autoAssignExam);

export default router;
