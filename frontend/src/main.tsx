import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Router from "./Router";
import "./index.css";
import { setupNavigationSentinel } from "./utils/navigationSentinel";

setupNavigationSentinel();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
