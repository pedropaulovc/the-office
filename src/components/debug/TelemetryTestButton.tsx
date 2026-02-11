"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

type TestStatus = "idle" | "loading" | "success" | "error";

export function TelemetryTestButton() {
  const [status, setStatus] = useState<TestStatus>("idle");

  function handleClick() {
    setStatus("loading");

    void Sentry.startSpan(
      { name: "telemetry-test-button", op: "ui.click" },
      async () => {
        try {
          const res = await fetch("/api/telemetry-test");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setStatus("success");
        } catch {
          setStatus("error");
        }
      },
    ).then(() => {
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    });
  }

  const label = {
    idle: "T",
    loading: "...",
    success: "OK",
    error: "!",
  }[status];

  return (
    <button
      onClick={handleClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white font-bold text-xs hover:bg-orange-500 transition-colors"
      title="Test Sentry telemetry (dev only)"
    >
      {label}
    </button>
  );
}
