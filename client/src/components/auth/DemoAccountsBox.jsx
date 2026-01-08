export default function DemoAccountsBox({ demoUsers, isLoading, onFill }) {
  return (
    <div className="text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3 mt-6">
      <p className="font-semibold mb-1">Accounts(click on Fill) - use all users in order to implement fully functionality :</p>

      <ul className="list-disc list-inside space-y-1">
        {demoUsers.map((d, idx) => (
          <li key={idx}>
            <strong>{d.label}:</strong> {d.u} / {d.p}
          </li>
        ))}
      </ul>

      {/* Fill buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {demoUsers.map((d, idx) => (
          <button
            key={idx}
            type="button"
            className="px-3 py-1 rounded-md bg-white border text-gray-700 hover:bg-gray-50"
            onClick={() => onFill(d)}
            disabled={isLoading}
          >
            Fill {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
