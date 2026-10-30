import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      NODE_ENV: "test",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8081",
      FIREBASE_PROJECT_ID: "ashmawy-test-suite",
      VITE_FIREBASE_PROJECT_ID: "ashmawy-test-suite",
      VITE_USE_FIREBASE_EMULATOR: "true",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
