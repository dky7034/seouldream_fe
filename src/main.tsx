import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx"; // Import AuthProvider
import "react-datepicker/dist/react-datepicker.css";
import "./styles/datepicker-tailwind.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      {" "}
      {/* Wrap App with AuthProvider */}
      <App />
    </AuthProvider>
  </StrictMode>
);
