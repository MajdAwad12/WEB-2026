// client/src/components/auth/ErrorAlert.jsx
export default function ErrorAlert({ type = "error", text = "" }) {
  const isError = type === "error";

  return (
    <div
      className={`mb-6 p-4 rounded-lg border ${
        isError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
      }`}
    >
      <div className="flex items-start">
        <div className="shrink-0">
          {isError ? (
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        <div className="ml-3">
          <h3 className={`text-sm font-medium ${isError ? "text-red-800" : "text-green-800"}`}>
            {isError ? "Error" : "Success"}
          </h3>
          <p className={`text-sm mt-1 ${isError ? "text-red-700" : "text-green-700"}`}>{text}</p>
        </div>
      </div>
    </div>
  );
}
