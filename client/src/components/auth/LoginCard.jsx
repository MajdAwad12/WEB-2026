export default function LoginCard({ shake, children }) {
  return (
    <div className={`bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 ${shake ? "shake" : ""}`}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Welcome Back</h2>
        <p className="text-sm text-gray-600 mt-2">Sign in to your account</p>
      </div>

      {children}
    </div>
  );
}
