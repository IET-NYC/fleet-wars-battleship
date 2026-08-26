import { afterEach } from "vitest";

// Testing Library's cleanup is only meaningful in jsdom; the Node logic tests
// import nothing from it, so guard on the DOM being present.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
