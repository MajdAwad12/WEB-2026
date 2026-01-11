// src/pages/auth/LoginPage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../services/auth.service";
import { useShake } from "../../hooks/useShake";

import LoginHeader from "../../components/auth/LoginHeader";
import LoginCard from "../../components/auth/LoginCard";
import ErrorAlert from "../../components/auth/ErrorAlert";
import LoginForm from "../../components/auth/LoginForm";
import DemoAccountsBox from "../../components/auth/DemoAccountsBox";
import SupportBox from "../../components/auth/SupportBox";
import AuthFooter from "../../components/auth/AuthFooter";

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { shake, triggerShake } = useShake(500);

  const demoUsers = useMemo(
    () => [
      { label: "Admin", u: "admin", p: "1234" },
      { label: "Supervisor1", u: "supervisor1", p: "1234" },
      { label: "Supervisor2", u: "supervisor2", p: "1234" },
      { label: "Supervisor3", u: "supervisor3", p: "1234" },
      { label: "Lecturer", u: "lecturer1", p: "1234" },
      { label: "Student", u: "std_3190010491096", p: "1234" },
    ],
    []
  );

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg("Please enter username and password.");
      triggerShake();
      return;
    }

    try {
      setIsLoading(true);

      // ✅ הכי חשוב: לשלוח אובייקט {username, password}
      const user = await loginUser({ username: u, password: p });

      // ניווט לפי role
      if (user?.role === "student") navigate("/app/dashboard", { replace: true });
      else navigate("/app/dashboard", { replace: true });



    } catch (err) {
      const msg = err?.message || "Invalid username or password. Please try again.";
      setErrorMsg(msg);
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }

  function onGoRegister() {
    navigate("/register");
  }

  function onFillDemo(d) {
    setUsername(d.u);
    setPassword(d.p);
    setErrorMsg("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-sky-600 to-cyan-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginHeader />

        <LoginCard shake={shake}>
          {errorMsg ? <ErrorAlert message={errorMsg} /> : null}

          <LoginForm
            username={username}
            password={password}
            setUsername={setUsername}
            setPassword={setPassword}
            isLoading={isLoading}
            onSubmit={onSubmit}
            onGoRegister={onGoRegister}
          />

          <DemoAccountsBox demoUsers={demoUsers} isLoading={isLoading} onFill={onFillDemo} />

          <SupportBox />
        </LoginCard>

        <AuthFooter />
      </div>
    </div>
  );
}
