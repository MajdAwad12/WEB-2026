// client/src/pages/auth/RegisterPage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import RegisterHeader from "../../components/auth/RegisterHeader";
import RegisterForm from "../../components/auth/RegisterForm";

import AuthFooter from "../../components/auth/AuthFooter";
import ErrorAlert from "../../components/auth/ErrorAlert";

import { isUsernameTaken, registerUser } from "../../services/auth.service";

export default function RegisterPage() {
  const navigate = useNavigate();

  const captcha = useMemo(() => {
    const a = Math.floor(Math.random() * (9 - 2 + 1)) + 2; // 2..9
    const b = Math.floor(Math.random() * (9 - 1 + 1)) + 1; // 1..9
    return { a, b, answer: a + b };
  }, []);

  const [message, setMessage] = useState({ show: false, type: "success", text: "" });

  async function handleSubmit(formData) {
    setMessage({ show: false, type: "success", text: "" });
    

    // 1) role validation
    if (!formData.role) {
      setMessage({ show: true, type: "error", text: "Please select a role (Supervisor or Lecturer)." });
      return;
    }

    // 2) passwords match
    if (formData.password !== formData.password2) {
      setMessage({ show: true, type: "error", text: "Passwords do not match." });
      return;
    }

    // 3) captcha check
    if (Number(formData.captchaAnswer) !== captcha.answer) {
      setMessage({ show: true, type: "error", text: "Security check failed. Please try again." });
      return;
    }

    // 4) username taken (optional but nice)
    try {
  const taken = await isUsernameTaken(formData.username);
  if (taken) {
    setMessage({ show: true, type: "error", text: "This username is already exist. Please choose another one." });
    return;
  }
  }catch {
    
    }

    // 5) register
    try {
      await registerUser({
        fullName: formData.fullName,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role, // "supervisor" | "lecturer"
      });

      setMessage({ show: true, type: "success", text: "Account created successfully! Redirecting to login…" });
      
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Registration failed. Please try again.";
      setMessage({ show: true, type: "error", text: msg });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-sky-600 to-cyan-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <RegisterHeader />

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create Account</h2>
            <p className="text-sm text-gray-600 mt-2">Register as a supervisor or lecturer</p>
          </div>

          {message.show && <ErrorAlert type={message.type} text={message.text} />}

          <RegisterForm
            onSubmit={handleSubmit}
            captchaLabel={`${captcha.a} + ${captcha.b} = ?`}
            onBackToLogin={() => navigate("/login")}
          />
        </div>

        <AuthFooter />
      </div>
    </div>
  );
}
