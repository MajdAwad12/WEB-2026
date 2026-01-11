export default function LoginForm({
  username,
  password,
  setUsername,
  setPassword,
  isLoading,
  onSubmit,
  onGoRegister,
}) {
  return (
    <form className="space-y-6" autoComplete="off" onSubmit={onSubmit}>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
          Username
        </label>
        <input
          type="text"
          id="username"
          name="login-username"
          placeholder="Enter your username"
          autoComplete="off"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          required
          disabled={isLoading}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="login-password"
          placeholder="Enter your password"
          autoComplete="off"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          required
          disabled={isLoading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold
               hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
               transition shadow-md hover:shadow-lg disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading ? "Signing In..." : "Sign In"}
      </button>

      <p className="text-xs text-gray-600 text-center">
        Don’t have an account?{" "}
        <button
          type="button"
          onClick={onGoRegister}
          className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
          disabled={isLoading}
        >
          Create one
        </button>
      </p>
    </form>
  );
}
