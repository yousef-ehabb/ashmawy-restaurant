import "@testing-library/jest-dom/vitest";

// Guarantee test environment variables are active before any test or module loads
process.env["NODE_ENV"] = "test";
process.env["FIRESTORE_EMULATOR_HOST"] = process.env["FIRESTORE_EMULATOR_HOST"] || "127.0.0.1:8081";
process.env["FIREBASE_PROJECT_ID"] = "ashmawy-test-suite";
process.env["VITE_FIREBASE_PROJECT_ID"] = "ashmawy-test-suite";
process.env["VITE_USE_FIREBASE_EMULATOR"] = "true";

// Production Safeguard: Never allow automated tests to run against live production Firestore
if (!process.env["FIRESTORE_EMULATOR_HOST"] || process.env["FIRESTORE_EMULATOR_HOST"].trim() === "") {
  throw new Error(
    "FATAL PRODUCTION SAFEGUARD: Automated tests cannot execute without FIRESTORE_EMULATOR_HOST set. " +
    "Running automated tests against live production Firestore is strictly forbidden."
  );
}

if (process.env["FIREBASE_PROJECT_ID"] === "ashmawy-ordering" && !process.env["ALLOW_DEV_NAMESPACE_IN_TESTS"]) {
  throw new Error(
    "FATAL ISOLATION BLOCK: Automated tests cannot use the 'ashmawy-ordering' project ID. " +
    "Tests must execute in an isolated namespace (e.g. 'ashmawy-test-suite') to protect development and production databases."
  );
}

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
