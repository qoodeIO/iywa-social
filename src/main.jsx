import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { SpaceStore } from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SpaceStore>
      <App />
    </SpaceStore>
  </StrictMode>
);
