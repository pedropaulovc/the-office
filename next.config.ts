import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  outputFileTracingRoot: import.meta.dirname,
  // The Claude Agent SDK spawns cli.js as a subprocess — it must be available
  // at runtime as-is, not bundled/tree-shaken by Next.js.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
