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
const isProd = process.env.NODE_ENV === "production";

/* =========================
   Trust proxy (Render / HTTPS cookies)
   - REQUIRED when behind a proxy (Render), otherwise secure cookies may not work.
========================= */
if (isProd) {
  app.set("trust proxy", 1);
}

/* =========================
   Body parser
========================= */
app.use(express.json());

/* =========================
   CORS
   - For Vercel client + Render server (cross-site cookies), we must use:
     credentials: true
     origin: exact allowed origin(s)
   - Put your Vercel URL(s) into CLIENT_ORIGIN:
     CLIENT_ORIGIN=https://your-app.vercel.app
     (You can allow multiple by comma-separated)
========================= */
const fromEnv = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Always allow local dev
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

// Allowed origins set
const ALLOWED_ORIGINS = new Set([...fromEnv, ...DEV_ORIGINS]);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / server-to-server / Postman (no Origin header)
      if (!origin) return cb(null, true);

      // exact match
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

      // Optional: allow any *.vercel.app (useful for preview deployments)
      // If you want to be strict, remove this block.
      if (origin.endsWith(".vercel.app")) return cb(null, true);

      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

/* =========================
   Session (MUST be before routes)
   - For cross-site cookies (Vercel <-> Render) in production:
     sameSite: "none"
     secure: true
     trust proxy enabled
========================= */
if (!process.env.MONGO_URI) {
  console.warn("⚠️ MONGO_URI is missing. Sessions store may fail in production.");
}

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,

    // Helps when behind proxies (Render)
    proxy: isProd,

    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),

    cookie: {
      httpOnly: true,

      // ✅ IMPORTANT:
      // Production (Vercel + Render) = cross-site => must be "none" + secure
      sameSite: isProd ? "none" : "lax",
      secure: isProd,

      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

/* =========================
   API Routes
========================= */
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

/* =========================
   Serve React build (OPTIONAL)
   - If you deploy client on Vercel, you DO NOT need this.
   - Keep it only if you ever deploy both client+server on the same host.
========================= */
if (isProd && process.env.SERVE_CLIENT === "true") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // server/index.js -> ../client/dist
  const distPath = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(distPath));

  // SPA fallback (do NOT catch /api or /assets)
  app.get(/^\/(?!api\/|assets\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* =========================
   START SERVER
========================= */
async function start() {
  try {
    await connectDB();
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log("🚀 Server running on", port));
  } catch (e) {
    console.log("❌ Server failed:", e.message);
    process.exit(1);
  }
}

start();
