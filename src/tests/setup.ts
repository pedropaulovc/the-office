import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Fail tests on any console.error or console.warn
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = vi.fn((...args: unknown[]) => {
    const message = args.join(" ");
    originalConsoleError.apply(console, args);
    throw new Error(`Unexpected console.error:\n${message}`);
  });

  console.warn = vi.fn((...args: unknown[]) => {
    originalConsoleWarn.apply(console, args);
    throw new Error(`Unexpected console.warn:\n${args.join(" ")}`);
  });
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
