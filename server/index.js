// server/index.js
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";

import authRoutes from "./src/routes/auth.routes.js";
import { connectDB } from "./src/db/connectDB.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import transferRoutes from "./src/routes/transfers.routes.js";
import examsRoutes from "./src/routes/exams.routes.js";
import messagesRoutes from "./src/routes/messages.routes.js";
import incidentsRoutes from "./src/routes/incidents.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";
import reportsRoutes from "./src/routes/reports.routes.js";
import studentRoutes from "./src/routes/student.routes.js";

dotenv.config();

const app = express();

// =========================
// Trust proxy (Render / HTTPS cookies)
// =========================
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// =========================
// Body parser
// =========================
app.use(express.json());

// =========================
// CORS (safe for same-domain + local dev)
// =========================
const fromEnv = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ...fromEnv,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://exam-monitoring-app.onrender.com",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin, server-side, Postman, etc.
      if (!origin) return cb(null, true);

      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// =========================
// Session (MUST be before routes)
// =========================
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax", // client + server are same domain
      secure: process.env.NODE_ENV === "production", // HTTPS on Render
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

// =========================
// API Routes
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/exams", examsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/incidents", incidentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/student", studentRoutes);

// =========================
// Serve React build (production)
// =========================
if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // server/index.js -> ../client/dist
  const distPath = path.join(__dirname, "..", "client", "dist");

  app.use(express.static(distPath));

  // ✅ SPA fallback
  // IMPORTANT: do NOT catch /api or /assets
  app.get(/^\/(?!api\/|assets\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// =========================
// START SERVER
// =========================
async function start() {
  try {
    await connectDB();
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log("🚀 Server running on", port));
  } catch (e) {
    console.log("❌ Server failed:", e.message);
  }
}

start();
