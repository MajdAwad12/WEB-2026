// server/src/routes/incidents.routes.js
import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { logIncident } from "../controllers/incidents.controller.js";

const router = Router();

// POST /api/incidents/:examId
router.post("/:examId", requireAuth, logIncident);

export default router;
