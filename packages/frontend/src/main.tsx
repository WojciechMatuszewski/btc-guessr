import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: {
      retry: false,
      refetchInterval: false,
      refetchOnMount: false,
      refetchIntervalInBackground: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
});

const element = document.getElementById("root")!;

ReactDOM.createRoot(element).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
