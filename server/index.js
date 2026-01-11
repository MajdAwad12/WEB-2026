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

// Body + CORS
app.use(express.json());  
const allowedOrigins = process.env.CLIENT_ORIGIN.split(",");

app.use(
  cors({
    origin: function (origin, callback) {
      // allow REST tools like Postman / same-origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ✅ SESSION MIDDLEWARE (חייב לפני routes)
app.use(
  session({
    name: "sid", // cookie name
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax", // dev: lax הכי פשוט
      secure: false,   // dev: false (ב-https זה true)
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

// Routes
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


// NOTE: exams are stored in the MongoDB collection "moddle" (see Exam model).
// The API is kept under /api/exams for simplicity.

// =========================
// Serve React build (production)
// =========================
if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // from: server/index.js -> ../client/dist
  const distPath = path.join(__dirname, "..", "client", "dist");

  app.use(express.static(distPath));

  // For React Router (SPA): return index.html for any unknown route
  // For React Router (SPA): return index.html for any unknown route
app.get(/^(?!\/assets\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

}


// ✅ START
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
