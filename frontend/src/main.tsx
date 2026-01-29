import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Router from "./Router";
import "./index.css";
import { setupNavigationSentinel } from "./utils/navigationSentinel";
import { findWorkingSignalServerDomain } from "./utils/unblocking";

findWorkingSignalServerDomain();

setupNavigationSentinel();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
