// server/src/routes/student.routes.js
import express from "express";
import requireAuth from "../middleware/requireAuth.js";
import { listMyEndedExams, getMyExamReport } from "../controllers/student.controller.js";

const router = express.Router();

router.use(requireAuth);

router.get("/exams", listMyEndedExams);
router.get("/exams/:examId/me", getMyExamReport);

export default router;
