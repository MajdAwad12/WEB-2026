import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { listMessages, sendMessage, markAllRead } from "../controllers/messages.controller.js";

const router = Router();

router.get("/:examId", requireAuth, listMessages);
router.post("/:examId", requireAuth, sendMessage);
router.post("/:examId/read-all", requireAuth, markAllRead);

export default router;
