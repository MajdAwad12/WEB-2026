// client/src/components/auth/RegisterForm.jsx
import { useState } from "react";

export default function RegisterForm({ onSubmit, captchaLabel, onBackToLogin }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    password2: "",
    role: "",
    captchaAnswer: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        password2: form.password2,
        role: form.role,
        captchaAnswer: form.captchaAnswer,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {/* Full name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          placeholder="e.g. Rina Cohen"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="name@example.com"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          required
        />
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => setField("username", e.target.value)}
          placeholder="Choose a username"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          required
        />
      </div>

      {/* Password + Confirm */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            type="password"
            value={form.password2}
            onChange={(e) => setField("password2", e.target.value)}
            placeholder="Repeat password"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            required
          />
        </div>
      </div>

      {/* Role */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-1">Role</p>

        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="supervisor"
              checked={form.role === "supervisor"}
              onChange={(e) => setField("role", e.target.value)}
              className="text-indigo-600 border-gray-300"
              required
            />
            <span>Supervisor</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="lecturer"
              checked={form.role === "lecturer"}
              onChange={(e) => setField("role", e.target.value)}
              className="text-indigo-600 border-gray-300"
              required
            />
            <span>Lecturer</span>
          </label>
        </div>

        <p className="text-[11px] text-gray-500 mt-1">
          For this demo, students are created by the system only.
        </p>
      </div>

      {/* Captcha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Simple security check
        </label>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold">
            {captchaLabel}
          </span>
          <input
            type="number"
            value={form.captchaAnswer}
            onChange={(e) => setField("captchaAnswer", e.target.value)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm"
            placeholder="Answer"
            required
          />
        </div>

        <p className="text-[11px] text-gray-500 mt-1">
          Tiny demo captcha (no real security, just for simulation).
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-semibold
                   hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
                   transition shadow-md hover:shadow-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating..." : "Create account"}
      </button>

      {/* Back to login */}
      <p className="text-xs text-gray-600 text-center">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onBackToLogin}
          className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Back to login
        </button>
      </p>
    </form>
  );
}
