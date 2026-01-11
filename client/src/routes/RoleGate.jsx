// client/src/routes/RoleGate.jsx
import { Navigate, useLocation, useOutletContext } from "react-router-dom";

/**
 * Role-based gate inside /app
 * Rules:
 * 1) While auth state is loading -> render nothing
 * 2) If not logged in -> redirect to /login
 * 3) If role not allowed -> redirect to fallback (with smart student handling)
 */
export default function RoleGate({ allow = [], children, fallback = "/app/dashboard" }) {
  const ctx = useOutletContext() || {};
  const me = ctx.me;
  const loadingMe = Boolean(ctx.loadingMe);
  const loc = useLocation();

  // Prevent redirect flicker while "me" is being fetched
  if (loadingMe) return null;

  // Not logged in
  if (!me) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // If no allow list -> allow everyone logged in
  if (!Array.isArray(allow) || allow.length === 0) return children;

  // Admin can access everything.
  const ok = me.role === "admin" || allow.includes(me.role);
  if (ok) return children;

  // ✅ Smart fallback: student always goes to /app/student
  const smartFallback = me.role === "student" ? "/app/student" : fallback;

  return <Navigate to={smartFallback} replace />;
}
