"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useApp } from "@/context/AppContext";

type EvalStatus = "idle" | "loading" | "success" | "error";

export function EvalTestButton() {
  const [status, setStatus] = useState<EvalStatus>("idle");
  const { currentUserId } = useApp();

  function handleClick() {
    setStatus("loading");

    void Sentry.startSpan(
      { name: "eval-test-button", op: "ui.click" },
      async () => {
        try {
          // 1. Create evaluation run
          const createRes = await fetch("/api/evaluations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: currentUserId,
              dimensions: ["adherence"],
              sampleSize: 5,
            }),
          });
          if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);
          const run = (await createRes.json()) as { id: string };

          // 2. Record a mock score
          const scoreRes = await fetch(`/api/evaluations/${run.id}/scores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dimension: "adherence",
              propositionId: "test-prop-1",
              score: 7,
              reasoning: "Test evaluation from debug button",
            }),
          });
          if (!scoreRes.ok) throw new Error(`Score failed: HTTP ${scoreRes.status}`);

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
    idle: "E",
    loading: "...",
    success: "\u2713",
    error: "!",
  }[status];

  const ariaLabel = {
    idle: "Run evaluation test (dev only)",
    loading: "Running evaluation test (dev only)",
    success: "Evaluation test passed (dev only)",
    error: "Evaluation test failed (dev only)",
  }[status];

  return (
    <button
      onClick={handleClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white font-bold text-xs hover:bg-green-500 transition-colors"
      title="Run evaluation test (dev only)"
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
