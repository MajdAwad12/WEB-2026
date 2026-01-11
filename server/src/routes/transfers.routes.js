// ===== file: server/src/routes/transfers.routes.js =====
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listTransfers,
  createTransfer,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
} from "../controllers/transfers.controller.js";

const router = express.Router();

router.get("/", requireAuth, listTransfers);
router.post("/", requireAuth, createTransfer);

router.post("/:id/approve", requireAuth, approveTransfer);
router.post("/:id/reject", requireAuth, rejectTransfer);
router.post("/:id/cancel", requireAuth, cancelTransfer);

export default router;
