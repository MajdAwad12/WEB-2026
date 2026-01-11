//server/src/routes/chat.routes.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { chatWithAI } from "../controllers/chat.controller.js";

const router = express.Router();

// authenticated chat (supervisor/lecturer/admin)
router.post("/", requireAuth, chatWithAI);

export default router;

