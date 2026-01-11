// client/src/routes/router.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout.jsx";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";

import DashboardPage from "../pages/dashboard/DashboardPage.jsx";
import ExamsPage from "../pages/exams/ExamsPage.jsx";
import ReportsPage from "../pages/reports/ReportsPage.jsx";
import ManageExamsPage from "../pages/admin/ManageExamsPage.jsx";

import StudentMyExamReportPage from "../pages/student/StudentMyExamReportPage.jsx";

import RoleGate from "./RoleGate.jsx";
import { useOutletContext } from "react-router-dom";

/** ✅ Smart fallback inside /app */
function AppFallback() {
  const ctx = useOutletContext() || {};
  const me = ctx.me;

  // If not loaded yet, do nothing (RoleGate already handles loading, but safe)
  if (!me) return <Navigate to="/login" replace />;

  // Student always lands on /app/student
  if (me.role === "student") return <Navigate to="/app/student" replace />;

  // Everyone else -> dashboard
  return <Navigate to="/app/dashboard" replace />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  {
    path: "/app",
    element: <AppLayout />,
    children: [
      // ✅ default landing inside /app
      { index: true, element: <AppFallback /> },

      // ✅ Supervisor + Lecturer + Admin
      {
        path: "dashboard",
        element: (
          <RoleGate allow={["supervisor", "lecturer", "admin"]}>
            <DashboardPage />
          </RoleGate>
        ),
      },

      // ✅ Supervisor + Lecturer + Admin
      {
        path: "exams",
        element: (
          <RoleGate allow={["supervisor", "lecturer", "admin"]}>
            <ExamsPage />
          </RoleGate>
        ),
      },

      // ✅ Lecturer + Admin
      {
        path: "reports",
        element: (
          <RoleGate allow={["lecturer", "admin"]}>
            <ReportsPage />
          </RoleGate>
        ),
      },

      // ✅ Admin only
      {
        path: "manage-exams",
        element: (
          <RoleGate allow={["admin"]}>
            <ManageExamsPage />
          </RoleGate>
        ),
      },

      // ✅ Student only (Read-only page)
      {
        path: "student",
        element: (
          <RoleGate allow={["student"]} fallback="/app/student">
            <StudentMyExamReportPage />
          </RoleGate>
        ),
      },

      // ✅ Smart fallback inside /app for unknown routes
      { path: "*", element: <AppFallback /> },
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default router;
