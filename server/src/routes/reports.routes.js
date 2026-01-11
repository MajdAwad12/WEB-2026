// server/src/routes/reports.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listReports,
  getReportsAnalytics,
  getReportDetails,
  downloadReportPDF,
  downloadReportCSV,
} from "../controllers/reports.controller.js";

const router = Router();

router.use(requireAuth);

// ✅ List ended exams (cards list)
router.get("/", listReports);

// ✅ Analytics for 4 charts (must be BEFORE "/:examId")
router.get("/analytics", getReportsAnalytics);

// ✅ Details
router.get("/:examId", getReportDetails);

// ✅ Export
router.get("/:examId/pdf", downloadReportPDF);
router.get("/:examId/csv", downloadReportCSV);

export default router;
