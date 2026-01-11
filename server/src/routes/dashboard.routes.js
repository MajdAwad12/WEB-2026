// ===== file: server/src/routes/dashboard.routes.js =====
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getDashboardSnapshot, getClock } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/snapshot", requireAuth, getDashboardSnapshot);
router.get("/clock", requireAuth, getClock);

export default router;
