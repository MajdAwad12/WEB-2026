// client/src/components/auth/RegisterHeader.jsx
export default function RegisterHeader() {
  return (
    <div className="text-center mb-8">
      <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">⏰</span>
      </div>

      <h1 className="text-3xl font-extrabold text-white tracking-tight">
        Exam Monitoring APP
      </h1>

      <p className="text-sm text-indigo-100 mt-2">
        Create a new account – Supervisor / Lecturer
      </p>
    </div>
  );
}
