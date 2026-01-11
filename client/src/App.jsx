import { RouterProvider } from "react-router-dom";
import router from "./routes/router.jsx";

/**
 * Root component of the app.
 * Keeps main.jsx focused on mounting React to the DOM.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
