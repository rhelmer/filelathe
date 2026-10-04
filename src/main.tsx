import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./toast";
import "./styles.css";

// The static heading stays in the document for crawlers. Once the app
// renders its own h1, hide the fallback from assistive tech.
document.getElementById("seo-fallback")?.setAttribute("aria-hidden", "true");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
