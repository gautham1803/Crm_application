import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createRootRoute, createRoute, createMemoryHistory } from "@tanstack/react-router";
import App from "./App";
import { AuthWrapper } from "./components/AuthWrapper";
import { ConfirmDialogProvider } from "./components/ConfirmDialog";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Simple root-level routing — we define the full router in App
const rootElement = document.getElementById("root")!;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthWrapper>
        <ConfirmDialogProvider>
          <App />
        </ConfirmDialogProvider>
      </AuthWrapper>
    </QueryClientProvider>
  </React.StrictMode>
);
