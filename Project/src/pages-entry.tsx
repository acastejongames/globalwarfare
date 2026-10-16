import { StrictMode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { createPagesRouter } from "./pages-router";

const container = document.getElementById("root");
if (!container) throw new Error("Falta el contenedor #root en pages.html");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={createPagesRouter()} />
  </StrictMode>,
);
