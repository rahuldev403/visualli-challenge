import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite only exposes VITE_-prefixed vars to the client by default.
  // API_ is whitelisted too so the backend URL can be named either way
  // depending on what the host platform allows.
  envPrefix: ["VITE_", "API_"],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
  },
});
